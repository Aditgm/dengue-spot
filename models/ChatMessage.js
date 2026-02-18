const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userAvatar: {
    type: String,
    default: null
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  reactions: {
    '👍': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '❤️': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '😂': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '😮': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '😢': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '🔥': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: String,
    enum: ['user', 'admin', null],
    default: null
  }
}, {
  timestamps: true
});

// Index for fetching room messages with pagination
chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Fix TTL index if it was previously created with different expiry
chatMessageSchema.statics.syncTTLIndex = async function() {
  try {
    const collection = this.collection;
    const indexes = await collection.indexes();
    const ttlIndex = indexes.find(idx => idx.key && idx.key.createdAt === 1 && idx.expireAfterSeconds !== undefined);
    if (ttlIndex && ttlIndex.expireAfterSeconds !== 7 * 24 * 60 * 60) {
      console.log('🔄 Updating chat TTL index from', ttlIndex.expireAfterSeconds, 'to', 7 * 24 * 60 * 60, 'seconds');
      await collection.dropIndex(ttlIndex.name);
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
      console.log('✅ Chat TTL index updated to 7 days');
    }
  } catch (err) {
    console.warn('⚠️ TTL index sync:', err.message);
  }
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
