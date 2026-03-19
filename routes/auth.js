const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Otp = require('../models/Otp');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../services/emailService');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post('/send-otp', async (req, res) => {
  try {
    console.log('\n=== SEND OTP CALLED ===');
    console.log('Raw body:', req.body);

    const { email, purpose } = req.body;

    if (!email || !purpose) {
      console.log('ERROR: Missing email or purpose');
      return res.status(400).json({ detail: 'Email and purpose are required' });
    }

    if (!['registration', 'login'].includes(purpose)) {
      console.log('ERROR: Invalid purpose:', purpose);
      return res.status(400).json({ detail: 'Invalid purpose' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);
    console.log('Purpose:', purpose);

    if (purpose === 'registration') {
      const existingUser = await User.findOne({ email: normalizedEmail });
      console.log('Existing user check:', existingUser ? 'FOUND - blocking' : 'not found - OK');
      if (existingUser) {
        return res.status(400).json({ detail: 'Email already registered' });
      }
    }

    if (purpose === 'login') {
      const user = await User.findOne({ email: normalizedEmail });
      console.log('Login user check:', user ? 'FOUND - OK' : 'NOT FOUND - blocking');
      if (!user) {
        return res.status(404).json({ detail: 'No account found with this email' });
      }
    }

    const otp = generateOTP();
    console.log('Generated OTP:', otp);

    console.log('Attempting to save OTP to DB...');
    const saved = await Otp.findOneAndUpdate(
      { email: normalizedEmail, purpose },
      {
        email: normalizedEmail,
        otp,
        purpose,
        attempts: 0,
        verified: false,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );
    console.log('OTP saved successfully:', JSON.stringify(saved));

    console.log('Sending email...');
    await sendOTPEmail(normalizedEmail, otp, purpose);
    console.log('Email sent successfully');

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('\n=== SEND OTP ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    console.log('\n=== VERIFY OTP CALLED ===');
    console.log('Body:', req.body);

    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({ detail: 'Email, OTP and purpose are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Looking for OTP record:', { email: normalizedEmail, purpose, verified: false });

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose, verified: false });
    console.log('OTP record found:', otpRecord ? JSON.stringify(otpRecord) : 'NONE');

    if (!otpRecord) {
      return res.status(400).json({ detail: 'No valid OTP found. Please request a new one.' });
    }

    if (otpRecord.attempts >= 3) {
      await Otp.deleteOne({ email: normalizedEmail, purpose });
      return res.status(400).json({ detail: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp) {
      console.log('OTP mismatch. Expected:', otpRecord.otp, 'Got:', otp);
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 3 - otpRecord.attempts;
      return res.status(400).json({
        detail: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();
    console.log('OTP verified successfully');

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('verify-otp error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    console.log('\n=== REGISTER CALLED ===');
    console.log('Body:', req.body);

    const { email, displayName, otp, avatar, status } = req.body;

    if (!email || !displayName) {
      return res.status(400).json({ detail: 'Email and display name are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: 'registration',
      verified: true,
    });
    console.log('Verified OTP record:', otpRecord ? 'FOUND' : 'NOT FOUND');

    if (!otpRecord) {
      return res.status(400).json({ detail: 'Please verify OTP first' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ detail: 'Email already registered' });
    }

    const user = new User({
      email: normalizedEmail,
      displayName: displayName.trim(),
      avatar:
        avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5E5CE6&color=fff`,
      status: status || "Hey there! I'm using ChatX",
    });

    await user.save();
    console.log('User created:', user._id);

    await Otp.deleteOne({ email: normalizedEmail, purpose: 'registration' });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      access_token: token,
      token_type: 'bearer',
      user_id: user._id,
      email: user.email,
      display_name: user.displayName,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('register error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('\n=== LOGIN CALLED ===');
    console.log('Body:', req.body);

    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ detail: 'Email and OTP are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Looking for OTP record:', { email: normalizedEmail, purpose: 'login' });

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose: 'login' });
    console.log('OTP record found:', otpRecord ? JSON.stringify(otpRecord) : 'NONE - THIS IS THE BUG');

    if (!otpRecord) {
      return res.status(400).json({ detail: 'No OTP found. Please request a new one.' });
    }

    const now = new Date();
    const expiryTime = 10 * 60 * 1000;
    const age = now - otpRecord.createdAt;
    console.log('OTP age (ms):', age, '| Expiry (ms):', expiryTime, '| Expired:', age > expiryTime);

    if (age > expiryTime) {
      await Otp.deleteOne({ email: normalizedEmail, purpose: 'login' });
      return res.status(400).json({ detail: 'OTP expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= 3) {
      await Otp.deleteOne({ email: normalizedEmail, purpose: 'login' });
      return res.status(400).json({ detail: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp) {
      console.log('OTP mismatch. Expected:', otpRecord.otp, 'Got:', otp);
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 3 - otpRecord.attempts;
      return res.status(400).json({
        detail: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    console.log('User found:', user ? user._id : 'NOT FOUND');

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save();

    await Otp.deleteOne({ email: normalizedEmail, purpose: 'login' });
    console.log('Login successful for:', normalizedEmail);

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      access_token: token,
      token_type: 'bearer',
      user_id: user._id,
      email: user.email,
      display_name: user.displayName,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('login error:', error);
    res.status(500).json({ detail: 'Server error' });
  }
});

module.exports = router;