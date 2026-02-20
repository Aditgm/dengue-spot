const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Hotspot = require('../models/Hotspot');
const Reporter = require('../models/Reporter');
const Checklist = require('../models/Checklist');
const BannedIp = require('../models/BannedIp');
const ChatMessage = require('../models/ChatMessage');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { refreshCache } = require('../middleware/ipBan');

router.use(authenticateToken, requireAdmin);
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'arajsinha4@gmail.com').toLowerCase();
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const pendingAdminRequests = await User.countDocuments({ adminRequestPending: true });
    const totalHotspots = await Hotspot.countDocuments();
    const pendingHotspots = await Hotspot.countDocuments({ status: 'reported' });
    const investigatingHotspots = await Hotspot.countDocuments({ status: 'investigating' });
    const resolvedHotspots = await Hotspot.countDocuments({ status: 'resolved' });
    const highRiskCount = await Hotspot.countDocuments({ riskLevel: 'high' });
    const totalReporters = await Reporter.countDocuments();

    // Recent activity — last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentHotspots = await Hotspot.countDocuments({ createdAt: { $gte: weekAgo } });
    const recentUsers = await User.countDocuments({ createdAt: { $gte: weekAgo } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAdmins,
        pendingAdminRequests,
        totalHotspots,
        pendingHotspots,
        investigatingHotspots,
        resolvedHotspots,
        highRiskCount,
        totalReporters,
        recentHotspots,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ---- Hotspot Management ----
router.get('/hotspots', async (req, res) => {
  try {
    const { status, risk, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (risk) filter.riskLevel = risk;

    const total = await Hotspot.countDocuments(filter);
    const hotspots = await Hotspot.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      hotspots,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin hotspots error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch hotspots' });
  }
});

router.patch('/hotspots/:id', async (req, res) => {
  try {
    const { status, riskLevel } = req.body;
    const update = {};
    if (status) update.status = status;
    if (riskLevel) update.riskLevel = riskLevel;

    const hotspot = await Hotspot.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!hotspot) {
      return res.status(404).json({ success: false, message: 'Hotspot not found' });
    }

    res.json({ success: true, hotspot });
  } catch (error) {
    console.error('Admin hotspot update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update hotspot' });
  }
});

router.delete('/hotspots/:id', async (req, res) => {
  try {
    const hotspot = await Hotspot.findByIdAndDelete(req.params.id);
    if (!hotspot) {
      return res.status(404).json({ success: false, message: 'Hotspot not found' });
    }
    res.json({ success: true, message: 'Hotspot deleted' });
  } catch (error) {
    console.error('Admin hotspot delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete hotspot' });
  }
});

// ---- User Management ----
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role || 'user',
        provider: u.provider,
        scanCount: u.scanCount || 0,
        lastLoginIp: u.lastLoginIp || null,
        isBanned: u.isBanned || false,
        banReason: u.banReason || null,
        createdAt: u.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Prevent demoting yourself
    if (req.params.id === req.user.userId && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot demote yourself' });
    }

    // Prevent demoting superadmin
    const targetUser = await User.findById(req.params.id).select('-password');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (targetUser.email === SUPER_ADMIN_EMAIL && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot demote the superadmin' });
    }

    targetUser.role = role;
    await targetUser.save();
    const user = targetUser;

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Admin role update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }

    // Prevent deleting superadmin
    const checkUser = await User.findById(req.params.id);
    if (checkUser && checkUser.email === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot delete the superadmin' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// ---- Ban / Unban User ----
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { reason } = req.body;
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Cannot ban yourself' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent banning superadmin
    if (targetUser.email === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot ban the superadmin' });
    }

    targetUser.isBanned = true;
    targetUser.banReason = reason || 'Banned by admin';
    await targetUser.save();

    res.json({ success: true, message: `User ${targetUser.name} has been banned` });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
});

router.patch('/users/:id/unban', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    targetUser.isBanned = false;
    targetUser.banReason = null;
    await targetUser.save();

    res.json({ success: true, message: `User ${targetUser.name} has been unbanned` });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
});

// ---- Reporters ----
router.get('/reporters', async (req, res) => {
  try {
    const reporters = await Reporter.find()
      .sort({ reports: -1 })
      .lean();

    res.json({ success: true, reporters });
  } catch (error) {
    console.error('Admin reporters error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reporters' });
  }
});

// ---- IP Ban Management ----
router.get('/banned-ips', async (req, res) => {
  try {
    const bannedIps = await BannedIp.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      bannedIps: bannedIps.map(b => ({
        id: b._id,
        ip: b.ip,
        reason: b.reason,
        associatedUser: b.associatedUser,
        createdAt: b.createdAt
      }))
    });
  } catch (error) {
    console.error('Fetch banned IPs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banned IPs' });
  }
});

router.post('/ban-ip', async (req, res) => {
  try {
    const { ip, reason, userName } = req.body;

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ success: false, message: 'IP address is required' });
    }

    const existing = await BannedIp.findOne({ ip: ip.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This IP is already banned' });
    }

    // Prevent banning superadmin's IP
    const superAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    if (superAdmin && superAdmin.lastLoginIp === ip.trim()) {
      return res.status(403).json({ success: false, message: 'Cannot ban the superadmin IP' });
    }

    await BannedIp.create({
      ip: ip.trim(),
      reason: reason || 'Banned by admin',
      bannedBy: req.user.userId,
      associatedUser: userName || null
    });

    await refreshCache();

    res.json({ success: true, message: `IP ${ip} has been banned` });
  } catch (error) {
    console.error('Ban IP error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban IP' });
  }
});

router.post('/ban-user-ip/:userId', async (req, res) => {
  try {
    const { reason } = req.body;
    const targetUser = await User.findById(req.params.userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!targetUser.lastLoginIp) {
      return res.status(400).json({ success: false, message: 'No IP recorded for this user' });
    }

    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Cannot ban your own IP' });
    }

    const existing = await BannedIp.findOne({ ip: targetUser.lastLoginIp });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This IP is already banned' });
    }
    if (targetUser.email === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot ban the superadmin IP' });
    }

    await BannedIp.create({
      ip: targetUser.lastLoginIp,
      reason: reason || `Banned via user: ${targetUser.name}`,
      bannedBy: req.user.userId,
      associatedUser: targetUser.name
    });

    await refreshCache();

    res.json({
      success: true,
      message: `IP ${targetUser.lastLoginIp} (${targetUser.name}) has been banned`
    });
  } catch (error) {
    console.error('Ban user IP error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban user IP' });
  }
});

router.delete('/banned-ips/:id', async (req, res) => {
  try {
    const banned = await BannedIp.findByIdAndDelete(req.params.id);
    if (!banned) {
      return res.status(404).json({ success: false, message: 'Banned IP not found' });
    }

    await refreshCache();

    res.json({ success: true, message: `IP ${banned.ip} has been unbanned` });
  } catch (error) {
    console.error('Unban IP error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban IP' });
  }
});

// ---- Chat Management ----
const CHAT_ROOMS = [
  { id: 'patna', name: 'Patna' }, { id: 'delhi', name: 'Delhi' },
  { id: 'mumbai', name: 'Mumbai' }, { id: 'chennai', name: 'Chennai' },
  { id: 'kolkata', name: 'Kolkata' }, { id: 'bangalore', name: 'Bengaluru' },
  { id: 'hyderabad', name: 'Hyderabad' }, { id: 'lucknow', name: 'Lucknow' },
  { id: 'ahmedabad', name: 'Ahmedabad' }, { id: 'pune', name: 'Pune' },
  { id: 'jaipur', name: 'Jaipur' }, { id: 'coimbatore', name: 'Coimbatore' },
  { id: 'general', name: 'General' }
];

// Get chat stats
router.get('/chat/stats', async (req, res) => {
  try {
    const totalMessages = await ChatMessage.countDocuments({ isDeleted: false });
    const deletedMessages = await ChatMessage.countDocuments({ isDeleted: true });
    const chatBannedUsers = await User.countDocuments({ isChatBanned: true });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = await ChatMessage.countDocuments({ createdAt: { $gte: weekAgo }, isDeleted: false });

    // Messages per room
    const roomStats = await ChatMessage.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$room', count: { $sum: 1 }, lastMessage: { $max: '$createdAt' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalMessages,
        deletedMessages,
        chatBannedUsers,
        recentMessages,
        roomStats: roomStats.map(r => ({
          room: r._id,
          name: CHAT_ROOMS.find(cr => cr.id === r._id)?.name || r._id,
          count: r.count,
          lastMessage: r.lastMessage
        }))
      }
    });
  } catch (error) {
    console.error('Chat stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chat stats' });
  }
});

// Get messages for a room (admin view — includes deleted)
router.get('/chat/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 30);
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const filter = { room: room.toLowerCase() };
    if (search) {
      filter.$or = [
        { text: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatMessage.countDocuments(filter);

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin chat messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Delete a chat message (admin)
router.delete('/chat/messages/:id', async (req, res) => {
  try {
    const message = await ChatMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    message.isDeleted = true;
    message.deletedBy = 'admin';
    message.text = '[Deleted by admin]';
    await message.save();

    // Emit socket event to update clients in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`community:${message.room}`).emit('message-deleted', {
        messageId: message._id.toString()
      });
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Admin delete message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

// Bulk delete messages by user in a room
router.delete('/chat/messages/user/:userId/room/:room', async (req, res) => {
  try {
    const { userId, room } = req.params;
    const result = await ChatMessage.updateMany(
      { userId, room: room.toLowerCase(), isDeleted: false },
      { $set: { isDeleted: true, deletedBy: 'admin', text: '[Deleted by admin]' } }
    );

    // Notify room clients
    const io = req.app.get('io');
    if (io) {
      const msgs = await ChatMessage.find({ userId, room: room.toLowerCase(), deletedBy: 'admin' }).select('_id').lean();
      msgs.forEach(m => {
        io.to(`community:${room}`).emit('message-deleted', { messageId: m._id.toString() });
      });
    }

    res.json({ success: true, message: `${result.modifiedCount} messages deleted` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk delete' });
  }
});

// Clear all messages in a room
router.delete('/chat/room/:room/clear', async (req, res) => {
  try {
    const { room } = req.params;
    const result = await ChatMessage.updateMany(
      { room: room.toLowerCase(), isDeleted: false },
      { $set: { isDeleted: true, deletedBy: 'admin', text: '[Cleared by admin]' } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`community:${room}`).emit('room-cleared', { room });
    }

    res.json({ success: true, message: `${result.modifiedCount} messages cleared from ${room}` });
  } catch (error) {
    console.error('Clear room error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear room' });
  }
});

// Ban user from chat
router.patch('/chat/ban/:userId', async (req, res) => {
  try {
    const { reason } = req.body;
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Cannot ban yourself from chat' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    targetUser.isChatBanned = true;
    targetUser.chatBanReason = reason || 'Banned from chat by admin';
    await targetUser.save();

    // Kick user from all chat rooms via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('chat-banned', { userId: targetUser._id.toString(), reason: targetUser.chatBanReason });
    }

    res.json({ success: true, message: `${targetUser.name} has been banned from chat` });
  } catch (error) {
    console.error('Chat ban error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban user from chat' });
  }
});

// Unban user from chat
router.patch('/chat/unban/:userId', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    targetUser.isChatBanned = false;
    targetUser.chatBanReason = null;
    await targetUser.save();

    res.json({ success: true, message: `${targetUser.name} has been unbanned from chat` });
  } catch (error) {
    console.error('Chat unban error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban user from chat' });
  }
});

// Get chat-banned users list
router.get('/chat/banned-users', async (req, res) => {
  try {
    const bannedUsers = await User.find({ isChatBanned: true })
      .select('name email chatBanReason createdAt')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      users: bannedUsers.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        reason: u.chatBanReason,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error('Fetch chat banned users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banned users' });
  }
});

// ---- Admin Role Requests ----
router.get('/admin-requests', async (req, res) => {
  try {
    const pendingUsers = await User.find({ adminRequestPending: true })
      .select('name email adminRequestReason adminRequestedAt createdAt')
      .sort({ adminRequestedAt: -1 })
      .lean();

    res.json({
      success: true,
      requests: pendingUsers.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        reason: u.adminRequestReason,
        requestedAt: u.adminRequestedAt,
        joinedAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error('Fetch admin requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin requests' });
  }
});

router.post('/admin-requests/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.adminRequestPending) {
      return res.status(400).json({ success: false, message: 'No pending admin request for this user' });
    }

    user.role = 'admin';
    user.adminRequestPending = false;
    user.adminRequestReason = null;
    user.adminRequestedAt = null;
    await user.save();

    res.json({ success: true, message: `${user.name} has been promoted to admin` });
  } catch (error) {
    console.error('Approve admin request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});

router.post('/admin-requests/:id/reject', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.adminRequestPending) {
      return res.status(400).json({ success: false, message: 'No pending admin request for this user' });
    }

    user.adminRequestPending = false;
    user.adminRequestReason = null;
    user.adminRequestedAt = null;
    await user.save();

    res.json({ success: true, message: `Admin request from ${user.name} has been rejected` });
  } catch (error) {
    console.error('Reject admin request error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
});

module.exports = router;
