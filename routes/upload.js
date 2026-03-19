const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const auth = require('../middleware/auth');

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Increased to 20MB for cloud videos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image, audio, and video files are allowed!'), false);
    }
  }
}).single('file');

router.post('/', auth, (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const folder = req.file.mimetype.split('/')[0] + 's'; // images, videos, audios
      
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `chatx/${folder}`,
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary error:', error);
            return res.status(500).json({ error: 'Failed to upload to cloud' });
          }
          res.json({ url: result.secure_url });
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(stream);
    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({ error: 'Failed to process upload' });
    }
  });
});

module.exports = router;
