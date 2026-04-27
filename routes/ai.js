const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * @route   POST api/ai/suggestions
 * @desc    Get AI-generated message suggestions
 * @access  Private
 */
router.post('/suggestions', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }
    const suggestions = await aiService.generateSuggestions(messages);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: "AI Suggestions failed" });
  }
});

/**
 * @route   POST api/ai/generate-image
 * @desc    Generate an image from a prompt
 * @access  Private
 */
router.post('/generate-image', auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const imageUrl = await aiService.generateImageFromPrompt(prompt);
    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: "Image generation failed" });
  }
});
/**
 * @route   POST api/ai/transcribe
 * @desc    Transcribe an audio message
 * @access  Private
 */
router.post('/transcribe', auth, async (req, res) => {
  try {
    const { audioUrl } = req.body;
    if (!audioUrl) {
      return res.status(400).json({ error: "audioUrl is required" });
    }
    const transcription = await aiService.transcribeAudio(audioUrl);
    res.json({ transcription });
  } catch (err) {
    res.status(500).json({ error: "Transcription failed" });
  }
});

/**
 * @route   POST api/ai/summarize
 * @desc    Summarize chat conversation
 * @access  Private
 */
router.post('/summarize', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }
    const summary = await aiService.summarizeChat(messages);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Summarization failed" });
  }
});

module.exports = router;
