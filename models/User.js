const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'Hey there! I\'m using ChatX',
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  fcmToken: {
    type: String,
    default: null,
  },
  aiPersona: {
    type: String,
    default: 'friendly',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);