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

// Check if team name or username exists
router.post('/check-availability', async (req, res) => {
  try {
    const { teamName, player1Username, player2Username } = req.body;
    const errors = {};

    // Check team name
    if (teamName) {
      const existingTeam = await Team.findOne({ teamName: new RegExp(`^${teamName}$`, 'i') });
      if (existingTeam) {
        errors.teamName = 'Team name already exists';
      }
    }

    // Check player1 username
    if (player1Username) {
      const existingPlayer1 = await Team.findOne({
        $or: [
          { 'player1.username': new RegExp(`^${player1Username}$`, 'i') },
          { 'player2.username': new RegExp(`^${player1Username}$`, 'i') }
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
          { 'player1.username': new RegExp(`^${player2Username}$`, 'i') },
          { 'player2.username': new RegExp(`^${player2Username}$`, 'i') }
        ]
      });
      if (existingPlayer2) {
        errors.player2Username = 'Username already exists';
      }
    }

    res.json({ errors: Object.keys(errors).length > 0 ? errors : null });
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send OTP for email verification
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    
    // Check if email is from CIT Chennai
    if (!email.endsWith('@citchennai.net')) {
      return res.status(400).json({ error: 'OTP verification is only required for @citchennai.net emails' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    await OTP.create({ email, otp });

    // Send OTP email
    await emailService.sendOTP(email, otp);

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Register team
router.post('/register', [
  body('teamName').trim().isLength({ min: 3, max: 50 }),
  body('player1.username').trim().isLength({ min: 3, max: 30 }),
  body('player1.email').isEmail().normalizeEmail(),
  body('player1.phone').trim().isLength({ min: 10, max: 15 }),
  body('player1.collegeName').trim().isLength({ min: 2, max: 100 }),
  body('player2.username').optional().trim().isLength({ min: 3, max: 30 }),
  body('player2.email').optional().isEmail().normalizeEmail(),
  body('player2.phone').optional().trim().isLength({ min: 10, max: 15 }),
  body('player2.collegeName').optional().trim().isLength({ min: 2, max: 100 }),
  body('teamLeader').isIn(['player1', 'player2'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teamName, player1, player2, teamLeader } = req.body;

    // Check if CIT emails are verified
    const citEmails = [];
    if (player1.email.endsWith('@citchennai.net')) {
      citEmails.push(player1.email);
    }
    if (player2 && player2.email.endsWith('@citchennai.net')) {
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
      teamName,
      player1: {
        ...player1,
        isVerified: player1.email.endsWith('@citchennai.net')
      },
      teamLeader
    };

    if (player2 && player2.username && player2.email) {
      teamData.player2 = {
        ...player2,
        isVerified: player2.email.endsWith('@citchennai.net')
      };
    }

    // Create team
    const team = new Team(teamData);
    await team.save();

    // Send confirmation email
    await emailService.sendRegistrationConfirmation(team);

    res.status(201).json({
      message: 'Team registered successfully',
      team: {
        teamName: team.teamName,
        registrationFee: team.registrationFee,
        isFree: team.isFree,
        paymentStatus: team.paymentStatus
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        error: `${field.includes('teamName') ? 'Team name' : 'Username'} already exists` 
      });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;