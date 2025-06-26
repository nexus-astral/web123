const express = require('express');
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const OTP = require('../models/OTP');
const emailService = require('../utils/emailService');
const router = express.Router();

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Middleware to handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Check if team name or username exists
router.post('/check-availability', asyncHandler(async (req, res) => {
  const { teamName, player1Username, player2Username } = req.body;
  const errors = {};

  // Check team name
  if (teamName) {
    const existingTeam = await Team.findOne({ 
      teamName: new RegExp(`^${teamName.trim()}$`, 'i') 
    });
    if (existingTeam) {
      errors.teamName = 'Team name already exists';
    }
  }

  // Check player1 username
  if (player1Username) {
    const existingPlayer1 = await Team.findOne({
      $or: [
        { 'player1.username': new RegExp(`^${player1Username.trim()}$`, 'i') },
        { 'player2.username': new RegExp(`^${player1Username.trim()}$`, 'i') }
      ]
    });
    if (existingPlayer1) {
      errors.player1Username = 'Username already exists';
    }
  }

  // Check player2 username
  if (player2Username) {
    const existingPlayer2 = await Team.findOne({
      $or: [
        { 'player1.username': new RegExp(`^${player2Username.trim()}$`, 'i') },
        { 'player2.username': new RegExp(`^${player2Username.trim()}$`, 'i') }
      ]
    });
    if (existingPlayer2) {
      errors.player2Username = 'Username already exists';
    }
  }

  res.json({ errors: Object.keys(errors).length > 0 ? errors : null });
}));

// Send OTP for email verification
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid email format',
      details: errors.array() 
    });
  }

  const { email } = req.body;
  
  // Check if email is from CIT Chennai
  if (!email.endsWith('@citchennai.net')) {
    return res.status(400).json({ 
      error: 'OTP verification is only required for @citchennai.net emails' 
    });
  }

  // Delete any existing OTPs for this email
  await OTP.deleteMany({ email });

  // Generate and save OTP
  const otp = generateOTP();
  await OTP.create({ email, otp });

  // Send OTP email
  try {
    await emailService.sendOTP(email, otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    res.status(500).json({ 
      error: 'Failed to send OTP. Please check your email configuration.' 
    });
  }
}));

// Verify OTP
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input',
      details: errors.array() 
    });
  }

  const { email, otp } = req.body;

  // Find valid OTP
  const otpRecord = await OTP.findOne({
    email,
    otp,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  res.json({ message: 'OTP verified successfully' });
}));

// Register team
router.post('/register', [
  body('teamName').trim().isLength({ min: 3, max: 50 }).withMessage('Team name must be 3-50 characters'),
  body('player1.username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('player1.email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('player1.phone').trim().isLength({ min: 10, max: 15 }).withMessage('Phone number must be 10-15 characters'),
  body('player1.collegeName').trim().isLength({ min: 2, max: 100 }).withMessage('College name must be 2-100 characters'),
  body('player2.username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('player2.email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('player2.phone').optional().trim().isLength({ min: 10, max: 15 }).withMessage('Phone number must be 10-15 characters'),
  body('player2.collegeName').optional().trim().isLength({ min: 2, max: 100 }).withMessage('College name must be 2-100 characters'),
  body('teamLeader').isIn(['player1', 'player2']).withMessage('Team leader must be player1 or player2')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }

  const { teamName, player1, player2, teamLeader } = req.body;

  // Check for duplicate team name and usernames
  const existingTeam = await Team.findOne({
    $or: [
      { teamName: new RegExp(`^${teamName.trim()}$`, 'i') },
      { 'player1.username': new RegExp(`^${player1.username.trim()}$`, 'i') },
      { 'player2.username': new RegExp(`^${player1.username.trim()}$`, 'i') },
      ...(player2 && player2.username ? [
        { 'player1.username': new RegExp(`^${player2.username.trim()}$`, 'i') },
        { 'player2.username': new RegExp(`^${player2.username.trim()}$`, 'i') }
      ] : [])
    ]
  });

  if (existingTeam) {
    return res.status(400).json({ 
      error: 'Team name or username already exists' 
    });
  }

  // Check if CIT emails are verified
  const citEmails = [];
  if (player1.email.endsWith('@citchennai.net')) {
    citEmails.push(player1.email);
  }
  if (player2 && player2.email && player2.email.endsWith('@citchennai.net')) {
    citEmails.push(player2.email);
  }

  // Verify CIT emails have been verified via OTP
  for (const email of citEmails) {
    const verifiedOTP = await OTP.findOne({
      email,
      isUsed: true,
      expiresAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) } // Within last 30 minutes
    });
    
    if (!verifiedOTP) {
      return res.status(400).json({ 
        error: `Email ${email} must be verified with OTP before registration` 
      });
    }
  }

  // Create team data
  const teamData = {
    teamName: teamName.trim(),
    player1: {
      username: player1.username.trim(),
      email: player1.email,
      phone: player1.phone.trim(),
      collegeName: player1.collegeName.trim(),
      isVerified: player1.email.endsWith('@citchennai.net')
    },
    teamLeader
  };

  if (player2 && player2.username && player2.email) {
    teamData.player2 = {
      username: player2.username.trim(),
      email: player2.email,
      phone: player2.phone.trim(),
      collegeName: player2.collegeName.trim(),
      isVerified: player2.email.endsWith('@citchennai.net')
    };
  }

  // Create team
  const team = new Team(teamData);
  await team.save();

  // Send confirmation email
  try {
    await emailService.sendRegistrationConfirmation(team);
  } catch (emailError) {
    console.error('Confirmation email failed:', emailError);
    // Don't fail registration if email fails
  }

  res.status(201).json({
    message: 'Team registered successfully',
    team: {
      teamName: team.teamName,
      registrationFee: team.registrationFee,
      isFree: team.isFree,
      paymentStatus: team.paymentStatus
    }
  });
}));

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Registration API is working' });
});

module.exports = router;