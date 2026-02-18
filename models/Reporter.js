const mongoose = require('mongoose');

const reporterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Reporter name is required'],
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reports: {
    type: Number,
    default: 0,
    min: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  badge: {
    type: String,
    enum: ['none', 'bronze', 'silver', 'gold', 'platinum'],
    default: 'none'
  }
}, {
  timestamps: true
});

reporterSchema.index({ name: 1 });
reporterSchema.index({ reports: -1 });

reporterSchema.methods.updateBadge = function() {
  if (this.reports >= 20) this.badge = 'platinum';
  else if (this.reports >= 10) this.badge = 'gold';
  else if (this.reports >= 5) this.badge = 'silver';
  else if (this.reports >= 2) this.badge = 'bronze';
  else this.badge = 'none';
};

module.exports = mongoose.model('Reporter', reporterSchema);
