const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// @route   GET /api/conversations
// @desc    Get all conversations for the current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'displayName email avatar isOnline lastSeen status')
      .populate('lastMessage.sender', 'displayName')
      .sort({ 'lastMessage.timestamp': -1 });

    // Format response — include the "other" participant info for 1:1 chats
    const formatted = conversations.map(conv => {
      const other = conv.participants.find(
        p => p._id.toString() !== userId
      );
      return {
        _id: conv._id,
        participant: other,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCounts?.get(userId) || 0,
        updatedAt: conv.updatedAt,
        wallpaperUrl: conv.wallpaperUrl,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   POST /api/conversations
// @desc    Create or find an existing 1:1 conversation
router.post('/', auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.userId;

    if (!participantId) {
      return res.status(400).json({ detail: 'participantId is required' });
    }

    if (participantId === userId) {
      return res.status(400).json({ detail: 'Cannot create conversation with yourself' });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Check for existing conversation between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId], $size: 2 },
    })
      .populate('participants', 'displayName email avatar isOnline lastSeen status')
      .populate('lastMessage.sender', 'displayName');

    if (conversation) {
      const other = conversation.participants.find(
        p => p._id.toString() !== userId
      );
      return res.json({
        _id: conversation._id,
        participant: other,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCounts?.get(userId) || 0,
        updatedAt: conversation.updatedAt,
        wallpaperUrl: conversation.wallpaperUrl,
        existing: true,
      });
    }

    // Create new conversation
    conversation = new Conversation({
      participants: [userId, participantId],
      lastMessage: {
        content: '',
        sender: userId,
        timestamp: new Date(),
        messageType: 'text',
      },
      unreadCounts: new Map([[userId, 0], [participantId, 0]]),
    });

    await conversation.save();

    // Populate and return
    await conversation.populate('participants', 'displayName email avatar isOnline lastSeen status');

    const other = conversation.participants.find(
      p => p._id.toString() !== userId
    );

    res.status(201).json({
      _id: conversation._id,
      participant: other,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      unreadCount: 0,
      updatedAt: conversation.updatedAt,
      wallpaperUrl: conversation.wallpaperUrl,
      existing: false,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   PUT /api/conversations/:id/wallpaper
// @desc    Update conversation wallpaper
router.put('/:id/wallpaper', auth, async (req, res) => {
  try {
    const { wallpaperUrl } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: req.user.userId },
      { wallpaperUrl },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ detail: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Update wallpaper error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

module.exports = router;
