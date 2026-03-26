module.exports = function(io) {
  const express = require('express');
  const router = express.Router();
  const auth = require('../middleware/auth');
  const Status = require('../models/Status');

  // @route   POST /api/status
  // @desc    Create a new status
  router.post('/', auth, async (req, res) => {
    try {
      const { mediaUrl, mediaType, caption } = req.body;

      if (!mediaUrl || !mediaType) {
        return res.status(400).json({ detail: 'Media URL and type are required' });
      }

      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const newStatus = new Status({
        userId: req.user.userId,
        mediaUrl,
        mediaType,
        caption: caption || '',
        expiresAt
      });

      const status = await newStatus.save();
      await status.populate('userId', 'displayName avatar');
      
      // Emit realtime update to all users
      if (io) {
        io.emit('status updated', {
          userId: req.user.userId,
          statusId: status._id
        });
      }
      
      res.status(201).json(status);
    } catch (error) {
      console.error('Status Creation Error:', error);
      res.status(500).json({ detail: 'Server error' });
    }
  });

  // @route   GET /api/status
  // @desc    Get all active statuses from all users
  router.get('/', auth, async (req, res) => {
    try {
      // Only fetch statuses that haven't expired yet
      const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
        .populate('userId', 'displayName avatar _id')
        .sort({ createdAt: -1 });
      
      // Group statuses by user
      const groupedStatuses = {};
      statuses.forEach(status => {
        const uId = status.userId._id.toString();
        if (!groupedStatuses[uId]) {
          groupedStatuses[uId] = {
            user: status.userId,
            statuses: []
          };
        }
        groupedStatuses[uId].statuses.push(status);
      });

      const result = Object.values(groupedStatuses);
      res.json(result);
    } catch (error) {
      console.error('Fetch Status Error:', error);
      res.status(500).json({ detail: 'Server error' });
    }
  });

  // @route   POST /api/status/:id/view
  // @desc    Mark status as viewed
  router.post('/:id/view', auth, async (req, res) => {
    try {
      const status = await Status.findById(req.params.id);
      if (!status) {
        return res.status(404).json({ detail: 'Status not found' });
      }

      // Add user to viewers if not already present
      if (!status.viewers.includes(req.user.userId)) {
        status.viewers.push(req.user.userId);
        await status.save();
      }

      res.json({ success: true });
    } catch (error) {
      console.error('View Status Error:', error);
      res.status(500).json({ detail: 'Server error' });
    }
  });

  return router;
};
