const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/users/me
// @desc    Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-__v');
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   PUT /api/users/me
// @desc    Update current user profile
router.put('/me', auth, async (req, res) => {
  try {
    const { displayName, status, avatar } = req.body;
    const updates = {};

    if (displayName) updates.displayName = displayName.trim();
    if (status !== undefined) updates.status = status;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   GET /api/users/search
// @desc    Search users by email or display name
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.userId } },
        {
          $or: [
            { email: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } },
          ],
        },
      ],
    }).limit(20).select('-__v');

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   POST /api/users/token
// @desc    Update FCM Token for push notifications
router.post('/token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ detail: 'FCM Token is required' });
    }

    await User.findByIdAndUpdate(req.user.userId, { fcmToken });
    res.json({ message: 'FCM Token updated' });
  } catch (error) {
    console.error('Update FCM Token error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   GET /api/users/persona
// @desc    Get user's AI persona
router.get('/persona', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('aiPersona');
    res.json({ persona: user?.aiPersona || 'friendly' });
  } catch (error) {
    console.error('Get persona error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

// @route   POST /api/users/persona
// @desc    Update user's AI persona
router.post('/persona', auth, async (req, res) => {
  try {
    const { persona } = req.body;
    if (!persona) return res.status(400).json({ detail: 'Persona is required' });
    
    await User.findByIdAndUpdate(req.user.userId, { aiPersona: persona });
    res.json({ message: 'AI Persona updated', persona });
  } catch (error) {
    console.error('Update persona error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

module.exports = router;