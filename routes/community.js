const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Available rooms (Indian cities with dengue hotspots)
const ROOMS = [
  { id: 'patna', name: 'Patna', state: 'Bihar' },
  { id: 'delhi', name: 'Delhi', state: 'Delhi NCR' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal' },
  { id: 'bangalore', name: 'Bengaluru', state: 'Karnataka' },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh' },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
  { id: 'pune', name: 'Pune', state: 'Maharashtra' },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu' },
  { id: 'general', name: 'General', state: 'All India' }
];

// GET /api/community/rooms — list available rooms
router.get('/rooms', (req, res) => {
  res.json({ success: true, rooms: ROOMS });
});

// GET /api/community/messages/:room — get message history (paginated)
router.get('/messages/:room',
  authenticateToken,
  async (req, res) => {
    try {
      const { room } = req.params;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 30));
      const skip = (page - 1) * limit;

      const validRoom = ROOMS.find(r => r.id === room.toLowerCase());
      if (!validRoom) {
        return res.status(400).json({ success: false, message: 'Invalid room' });
      }

      const messages = await ChatMessage.find({
        room: room.toLowerCase(),
        isDeleted: false
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await ChatMessage.countDocuments({
        room: room.toLowerCase(),
        isDeleted: false
      });

      res.json({
        success: true,
        messages: messages.reverse(), // Return oldest first for display
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + limit < total
        }
      });
    } catch (error) {
      console.error('Fetch messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }
);

// DELETE /api/community/messages/:id — delete a message (own or admin)
router.delete('/messages/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const message = await ChatMessage.findById(req.params.id);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      const isOwner = message.userId.toString() === req.user.userId;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      message.isDeleted = true;
      message.deletedBy = isAdmin && !isOwner ? 'admin' : 'user';
      message.text = '[Message deleted]';
      await message.save();

      res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
  }
);

// GET /api/community/rooms/:room/online — get online user count (populated by socket.io)
router.get('/rooms/:room/online', (req, res) => {
  // This will be enhanced by socket.io — for now return 0
  const io = req.app.get('io');
  if (io) {
    const roomName = `community:${req.params.room.toLowerCase()}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    const count = room ? room.size : 0;
    return res.json({ success: true, online: count });
  }
  res.json({ success: true, online: 0 });
});

module.exports = { router, ROOMS };
