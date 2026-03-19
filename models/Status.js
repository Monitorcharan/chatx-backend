const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    caption: {
      type: String,
      maxlength: 255,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // Automatically delete documents when they expire!
    },
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Status', statusSchema);
