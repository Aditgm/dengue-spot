const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  code: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['login', 'register', 'reset-password'],
    default: 'login'
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index — auto-deletes expired OTPs
  }
}, {
  timestamps: true
});

// Index for quick lookup
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('Otp', otpSchema);
