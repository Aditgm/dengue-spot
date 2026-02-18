const mongoose = require('mongoose');

const bannedIpSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reason: {
    type: String,
    default: 'Banned by admin'
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  associatedUser: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BannedIp', bannedIpSchema);
