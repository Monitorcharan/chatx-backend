const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

// Track which userId maps to which socket(s)
const userSockets = new Map(); // userId -> Set of socketIds

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join user's own room based on userId
    socket.on('join', async (userId) => {
      socket.userId = userId;
      socket.join(userId);

      // Track socket mapping
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);

      // Update user online status
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      // Broadcast online status
      const conversations = await Conversation.find({ participants: userId });
      conversations.forEach(conv => {
        conv.participants.forEach(pId => {
          const pid = pId.toString();
          if (pid !== userId) {
            io.to(pid).emit('user online', { userId });
          }
        });
      });

      // Mark pending messages as delivered
      try {
        const undeliveredMessages = await Message.find({
          receiver: userId,
          status: 'sent'
        });

        if (undeliveredMessages.length > 0) {
          await Message.updateMany(
            { receiver: userId, status: 'sent' },
            { status: 'delivered' }
          );

          // Notify senders
          undeliveredMessages.forEach(msg => {
            io.to(msg.sender.toString()).emit('message delivered', {
              messageId: msg._id,
              conversationId: msg.conversationId,
            });
          });
        }
      } catch (err) {
        console.error('Error marking messages as delivered on join:', err);
      }

      console.log(`User ${userId} joined`);
    });

    // Handle private message
    socket.on('private message', async ({
      senderId,
      receiverId,
      conversationId,
      content,
      messageType = 'text',
      isSelfDestruct = false,
      expiresAt = null,
    }) => {
      try {
        // Find or validate conversation
        let conversation;
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
        }

        if (!conversation) {
          // Find existing conversation between these users
          conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId], $size: 2 },
          });
        }

        if (!conversation) {
          // Create new conversation
          conversation = new Conversation({
            participants: [senderId, receiverId],
            unreadCounts: new Map([[senderId, 0], [receiverId, 0]]),
          });
          await conversation.save();
        }

        // Save message to database
        const message = new Message({
          conversationId: conversation._id,
          sender: senderId,
          receiver: receiverId,
          content,
          messageType,
          status: 'sent',
          isSelfDestruct,
          expiresAt,
        });
        await message.save();

        // Update conversation's lastMessage and unread count
        conversation.lastMessage = {
          content,
          sender: senderId,
          timestamp: message.createdAt,
          messageType,
        };

        // Increment unread count for receiver
        const currentUnread = conversation.unreadCounts?.get(receiverId) || 0;
        conversation.unreadCounts.set(receiverId, currentUnread + 1);

        await conversation.save();

        // Populate sender info
        await message.populate('sender', 'displayName avatar');

        const messageData = {
          ...message.toObject(),
          conversationId: conversation._id,
        };

        // Emit to receiver
        io.to(receiverId).emit('new message', messageData);

        // Emit back to sender for confirmation
        io.to(senderId).emit('message sent', messageData);

        // Check if receiver is online — if so, mark as delivered
        if (userSockets.has(receiverId) && userSockets.get(receiverId).size > 0) {
          message.status = 'delivered';
          await message.save();
          io.to(senderId).emit('message delivered', {
            messageId: message._id,
            conversationId: conversation._id,
          });
        } else {
          // RECEIVER IS OFFLINE - SEND PUSH NOTIFICATION
          try {
            const { sendNotification } = require('../services/notificationService');
            const receiver = await User.findById(receiverId);
            if (receiver && receiver.fcmToken) {
              const sender = await User.findById(senderId);
              await sendNotification(receiver.fcmToken, {
                title: sender ? sender.displayName : 'New Message',
                body: messageType === 'text' ? content : `Sent a ${messageType}`,
                data: {
                  type: 'chat',
                  senderId: senderId,
                  conversationId: conversation._id.toString(),
                }
              });
            }
          } catch (notifErr) {
            console.error('Failed to send push notification:', notifErr);
          }
        }
      } catch (error) {
        console.error('Error handling private message:', error);
        socket.emit('message error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ senderId, receiverId, conversationId, isTyping }) => {
      io.to(receiverId).emit('typing', {
        senderId,
        conversationId,
        isTyping,
      });
    });

    // Handle message reactions
    socket.on('message reaction', async ({ messageId, userId, emoji, conversationId, contactId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Check if user already reacted
        const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId);
        
        if (existingReactionIndex > -1) {
          if (message.reactions[existingReactionIndex].emoji === emoji) {
             // Remove reaction if same emoji (toggle)
             message.reactions.splice(existingReactionIndex, 1);
          } else {
             // Update emoji
             message.reactions[existingReactionIndex].emoji = emoji;
          }
        } else {
          // Add new reaction
          message.reactions.push({ userId, emoji });
        }

        await message.save();

        // Notify both parties
        io.to(userId).emit('message reaction', { messageId, reactions: message.reactions, conversationId });
        io.to(contactId).emit('message reaction', { messageId, reactions: message.reactions, conversationId });
      } catch (error) {
        console.error('Reaction Error:', error);
      }
    });

    // Handle read receipts
    socket.on('messages read', async ({ userId, conversationId, contactId }) => {
      try {
        // Update all unread messages from contactId to userId in this conversation
        await Message.updateMany(
          {
            conversationId,
            sender: contactId,
            receiver: userId,
            status: { $ne: 'read' },
          },
          { status: 'read' }
        );

        // Reset unread count for this user in the conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCounts.${userId}`]: 0,
        });

        // Notify the contact that their messages were read
        io.to(contactId).emit('messages read', {
          conversationId,
          readBy: userId,
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // ==================== WEBRTC SIGNALING ====================

    // 1. Call Offer
    socket.on('call offer', async ({ callerId, receiverId, offer, isVideoString }) => {
      console.log(`Call offer from ${callerId} to ${receiverId}`);
      const caller = await User.findById(callerId).select('displayName avatar');
      io.to(receiverId).emit('call offer', {
        callerId,
        callerName: caller?.displayName || 'Unknown',
        callerAvatar: caller?.avatar,
        offer,
        isVideoString,
      });

      // PUSH NOTIFICATION FOR CALL
      try {
        const receiver = await User.findById(receiverId);
        if (receiver && receiver.fcmToken) {
          const { sendNotification } = require('../services/notificationService');
          await sendNotification(receiver.fcmToken, {
            title: `Incoming ${isVideoString === 'true' ? 'Video' : 'Voice'} Call`,
            body: `${caller?.displayName || 'Someone'} is calling you`,
            data: {
              type: 'call',
              callerId: callerId,
              isVideo: isVideoString,
            }
          });
        }
      } catch (notifErr) {
        console.error('Failed to send call push notification:', notifErr);
      }
    });

    // 2. Call Answer
    socket.on('call answer', ({ receiverId, callerId, answer }) => {
      console.log(`📡 [WebRTC] Signal: 'call answer' from ${receiverId} to ${callerId}`);
      io.to(callerId).emit('call answer', {
        receiverId,
        answer,
      });
    });

    // 3. ICE Candidates
    socket.on('ice candidate', ({ senderId, targetId, candidate }) => {
      console.log(`📡 [WebRTC] Signal: 'ice candidate' from ${senderId} to ${targetId}`);
      io.to(targetId).emit('ice candidate', {
        senderId,
        candidate,
      });
    });

    // 4. End Call
    socket.on('end call', ({ senderId, targetId }) => {
      console.log(`📡 [WebRTC] Signal: 'end call' by ${senderId} for ${targetId}`);
      io.to(targetId).emit('end call', { senderId });
    });

    // 5. Reject Call
    socket.on('call rejected', ({ receiverId, callerId }) => {
      console.log(`Call rejected by ${receiverId} for ${callerId}`);
      io.to(callerId).emit('call rejected', { receiverId });
    });

    // 6. Cancel Call (Caller cancels before answer)
    socket.on('call cancel', ({ callerId, receiverId }) => {
      console.log(`Call cancelled by ${callerId} for ${receiverId}`);
      io.to(receiverId).emit('call cancel', { callerId });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      console.log('Client disconnected:', socket.id);

      if (userId) {
        // Remove this socket from tracking
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);

            // User is fully offline
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: new Date(),
            });

            // Broadcast offline status
            const conversations = await Conversation.find({ participants: userId });
            conversations.forEach(conv => {
              conv.participants.forEach(pId => {
                const pid = pId.toString();
                if (pid !== userId) {
                  io.to(pid).emit('user offline', {
                    userId,
                    lastSeen: new Date(),
                  });
                }
              });
            });
          }
        }
      }
    });
  });
};