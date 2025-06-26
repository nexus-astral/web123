const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  collegeName: {
    type: String,
    required: true,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
});

const teamSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  player1: {
    type: playerSchema,
    required: true
  },
  player2: {
    type: playerSchema,
    required: false
  },
  teamLeader: {
    type: String,
    required: true,
    enum: ['player1', 'player2']
  },
  registrationFee: {
    type: Number,
    required: true,
    default: 25
  },
  isFree: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'free'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Check if team qualifies for free registration
teamSchema.pre('save', function(next) {
  const player1Email = this.player1.email;
  const player2Email = this.player2 ? this.player2.email : null;
  
  const isCitEmail = (email) => email && email.endsWith('@citchennai.net');
  
  if (isCitEmail(player1Email) && (!player2Email || isCitEmail(player2Email))) {
    this.isFree = true;
    this.registrationFee = 0;
    this.paymentStatus = 'free';
  }
  
  next();
});

module.exports = mongoose.model('Team', teamSchema);