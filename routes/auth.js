const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  storeSession,
  getSession,
  deleteSession,
  blacklistToken,
  verifyToken
} = require('../utils/jwt');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/email');
const { registerValidation, loginValidation } = require('../middleware/validators');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// Multer for avatar upload (memory storage for Cloudinary)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

router.post(
  '/register',
  rateLimiter({ max: 5, keyPrefix: 'register:', message: 'Too many registration attempts' }),
  registerValidation,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        // If user exists but email not verified, allow re-registration
        if (!existingUser.isEmailVerified) {
          // Update the existing unverified user's details
          existingUser.name = name;
          existingUser.password = password; // will be re-hashed by pre-save hook
          await existingUser.save();

          // Send OTP for registration verification
          await Otp.deleteMany({ email: email.toLowerCase(), purpose: 'register' });
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          await Otp.create({
            email: email.toLowerCase(),
            code,
            purpose: 'register',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
          });
          await sendOtpEmail(email, code, 'register');

          return res.status(201).json({
            success: true,
            message: 'Verification OTP sent to your email',
            requiresVerification: true,
            email: email.toLowerCase()
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Create user with isEmailVerified = false (no tokens yet)
      const newUser = await User.create({ name, email, password, isEmailVerified: false });

      // Generate and send registration OTP
      await Otp.deleteMany({ email: email.toLowerCase(), purpose: 'register' });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await Otp.create({
        email: email.toLowerCase(),
        code,
        purpose: 'register',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      await sendOtpEmail(email, code, 'register');

      res.status(201).json({
        success: true,
        message: 'Verification OTP sent to your email',
        requiresVerification: true,
        email: email.toLowerCase()
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  }
);

// Apply to become admin (authenticated users only)
router.post(
  '/apply-admin',
  authenticateToken,
  rateLimiter({ max: 3, keyPrefix: 'apply-admin:', message: 'Too many requests' }),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.role === 'admin') {
        return res.status(400).json({ success: false, message: 'You are already an admin' });
      }

      if (user.adminRequestPending) {
        return res.status(400).json({ success: false, message: 'You already have a pending admin request' });
      }

      const { reason } = req.body;
      user.adminRequestPending = true;
      user.adminRequestReason = reason || 'No reason provided';
      user.adminRequestedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Admin request submitted. An admin will review your request.'
      });
    } catch (error) {
      console.error('Apply admin error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit admin request' });
    }
  }
);

router.post(
  '/login',
  rateLimiter({ max: 5, keyPrefix: 'login:', message: 'Too many login attempts' }),
  loginValidation,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if email is verified (skip for admin or Google users)
      if (!user.isEmailVerified && user.provider === 'local') {
        // Resend verification OTP
        await Otp.deleteMany({ email: email.toLowerCase(), purpose: 'register' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await Otp.create({
          email: email.toLowerCase(),
          code,
          purpose: 'register',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });
        await sendOtpEmail(email, code, 'register');

        return res.status(403).json({
          success: false,
          message: 'Email not verified. A new verification code has been sent.',
          requiresVerification: true,
          email: email.toLowerCase()
        });
      }

      // Check if user is banned
      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: `Your account has been banned. Reason: ${user.banReason || 'Violation of terms'}`
        });
      }

      const accessToken = generateAccessToken(user._id.toString(), user.email);
      const refreshToken = generateRefreshToken(user._id.toString(), user.email);

      await storeSession(user._id.toString(), {
        email: user.email,
        name: user.name,
        loginAt: new Date().toISOString(),
        ip: req.ip
      });

      // Track IP
      user.lastLoginIp = req.ip;
      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        user: user.toPublicJSON(),
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    }
  }
);

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(403).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const session = await getSession(decoded.userId);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    const accessToken = generateAccessToken(decoded.userId, decoded.email);

    res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers['authorization'].split(' ')[1];
    const { userId } = req.user;

    await blacklistToken(token);
    await deleteSession(userId);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        ...user.toPublicJSON(),
        ...req.user.session
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { userId, email } = req.user;
    const User = require('../models/User');
    const Hotspot = require('../models/Hotspot');
    const Checklist = require('../models/Checklist');
    const Reporter = require('../models/Reporter');

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userName = user.name;
    const mongoose = require('mongoose');
    const reportQuery = {
      $or: [
        { reporterName: { $regex: new RegExp(`^${userName}$`, 'i') } },
        { reporterName: userId }
      ]
    };
    if (mongoose.Types.ObjectId.isValid(userId)) {
      reportQuery.$or.push({ reportedBy: new mongoose.Types.ObjectId(userId) });
    }
    const reports = await Hotspot.find(reportQuery).sort({ createdAt: -1 }).lean();

    const reporter = await Reporter.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${userName}$`, 'i') } },
        { userId: userId }
      ]
    }).lean();

    let leaderboardRank = null;
    if (reporter) {
      const higherCount = await Reporter.countDocuments({ reports: { $gt: reporter.reports } });
      leaderboardRank = higherCount + 1;
    }

    const checklists = await Checklist.find({ userId }).sort({ week: -1 }).lean();

    let checklistStreak = 0;
    const currentWeek = (() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
      return Math.ceil((days + start.getDay() + 1) / 7);
    })();

    const weekMap = {};
    checklists.forEach(cl => {
      const total = cl.items.length;
      const done = cl.items.filter(it => it.completed).length;
      weekMap[cl.week] = { week: cl.week, progress: total > 0 ? (done / total) * 100 : 0, completed: total > 0 && done === total };
    });

    for (let w = currentWeek; w >= 1; w--) {
      if (weekMap[w] && weekMap[w].completed) {
        checklistStreak++;
      } else {
        break;
      }
    }

    const currentChecklist = checklists.find(c => c.week === currentWeek);
    let currentWeekProgress = 0;
    if (currentChecklist) {
      const total = currentChecklist.items.length;
      const done = currentChecklist.items.filter(i => i.completed).length;
      currentWeekProgress = total > 0 ? (done / total) * 100 : 0;
    }

    const checklistHistory = [];
    for (let w = currentWeek; w > Math.max(0, currentWeek - 12); w--) {
      if (weekMap[w]) {
        checklistHistory.push(weekMap[w]);
      } else {
        checklistHistory.push({ week: w, progress: 0, completed: false });
      }
    }

    res.json({
      success: true,
      user: user.toPublicJSON(),
      stats: {
        totalReports: reports.length,
        totalScans: user.scanCount || 0,
        checklistStreak,
        currentWeekProgress
      },
      reports: reports.map(r => ({
        description: r.description,
        riskLevel: r.riskLevel,
        status: r.status,
        createdAt: r.createdAt,
        latitude: r.latitude,
        longitude: r.longitude
      })),
      badges: reporter ? [reporter.badge] : [],
      checklistHistory,
      leaderboardRank
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// ---- Avatar Upload ----
router.post('/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let avatarUrl = '';

    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'denguespot-avatars',
            transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face', quality: 'auto' }],
            public_id: `avatar-${user._id}-${Date.now()}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      avatarUrl = result.secure_url;
    } else {
      // Fallback: save as base64 data URL
      const base64 = req.file.buffer.toString('base64');
      avatarUrl = `data:${req.file.mimetype};base64,${base64}`;
    }

    user.avatar = avatarUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      avatar: avatarUrl,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload avatar' });
  }
});

// ---- OTP: Send ----
router.post(
  '/send-otp',
  rateLimiter({ max: 5, keyPrefix: 'send-otp:', message: 'Too many OTP requests. Please wait.' }),
  async (req, res) => {
    try {
      const { email, purpose } = req.body;

      if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
        return res.status(400).json({ success: false, message: 'Valid email is required' });
      }

      const validPurpose = ['login', 'register', 'reset-password'].includes(purpose) ? purpose : 'login';

      // For login OTP, check if user exists
      if (validPurpose === 'login') {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(404).json({ success: false, message: 'No account found with this email' });
        }
        if (user.isBanned) {
          return res.status(403).json({ success: false, message: 'Your account has been banned' });
        }
      }

      // Delete any existing OTPs for this email+purpose
      await Otp.deleteMany({ email: email.toLowerCase(), purpose: validPurpose });

      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Create OTP record (expires in 5 minutes)
      await Otp.create({
        email: email.toLowerCase(),
        code,
        purpose: validPurpose,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      // Send OTP email
      await sendOtpEmail(email, code, validPurpose);

      res.json({
        success: true,
        message: 'OTP sent to your email'
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  }
);

// ---- OTP: Verify ----
router.post(
  '/verify-otp',
  rateLimiter({ max: 10, keyPrefix: 'verify-otp:', message: 'Too many verification attempts' }),
  async (req, res) => {
    try {
      const { email, code, purpose } = req.body;

      if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
      }

      const validPurpose = ['login', 'register', 'reset-password'].includes(purpose) ? purpose : 'login';

      const otp = await Otp.findOne({
        email: email.toLowerCase(),
        purpose: validPurpose,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP expired or not found. Request a new one.' });
      }

      // Check attempts (max 5)
      if (otp.attempts >= 5) {
        await Otp.deleteOne({ _id: otp._id });
        return res.status(400).json({ success: false, message: 'Too many failed attempts. Request a new OTP.' });
      }

      if (otp.code !== code.trim()) {
        otp.attempts += 1;
        await otp.save();
        return res.status(400).json({
          success: false,
          message: `Invalid OTP. ${5 - otp.attempts} attempts remaining.`
        });
      }

      // OTP is valid — mark as verified
      otp.verified = true;
      await otp.save();

      // For login purpose, issue tokens
      if (validPurpose === 'login') {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isBanned) {
          return res.status(403).json({ success: false, message: 'Your account has been banned' });
        }

        const accessToken = generateAccessToken(user._id.toString(), user.email);
        const refreshToken = generateRefreshToken(user._id.toString(), user.email);

        await storeSession(user._id.toString(), {
          email: user.email,
          name: user.name,
          loginAt: new Date().toISOString(),
          ip: req.ip,
          method: 'otp'
        });

        user.lastLoginIp = req.ip;
        await user.save();

        // Cleanup OTP
        await Otp.deleteMany({ email: email.toLowerCase(), purpose: validPurpose });

        return res.json({
          success: true,
          message: 'OTP verified — login successful',
          user: user.toPublicJSON(),
          accessToken,
          refreshToken
        });
      }

      // For register purpose — verify email, issue tokens, complete registration
      if (validPurpose === 'register') {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(404).json({ success: false, message: 'Registration not found. Please register again.' });
        }

        user.isEmailVerified = true;
        user.lastLoginIp = req.ip;
        await user.save();

        const accessToken = generateAccessToken(user._id.toString(), user.email);
        const refreshToken = generateRefreshToken(user._id.toString(), user.email);

        await storeSession(user._id.toString(), {
          email: user.email,
          name: user.name,
          loginAt: new Date().toISOString(),
          ip: req.ip,
          method: 'registration'
        });

        // Cleanup OTP
        await Otp.deleteMany({ email: email.toLowerCase(), purpose: validPurpose });

        return res.json({
          success: true,
          message: 'Email verified — registration complete!',
          user: user.toPublicJSON(),
          accessToken,
          refreshToken
        });
      }

      // For other purposes, just confirm verification
      res.json({
        success: true,
        message: 'OTP verified successfully',
        verified: true
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
  }
);

module.exports = router;
