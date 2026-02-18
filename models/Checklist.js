const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  id: Number,
  task: String,
  completed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const checklistSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  week: {
    type: Number,
    required: true
  },
  items: [checklistItemSchema]
}, {
  timestamps: true
});

checklistSchema.index({ userId: 1, week: 1 }, { unique: true });

module.exports = mongoose.model('Checklist', checklistSchema);
