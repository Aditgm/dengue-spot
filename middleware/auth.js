const { verifyToken, getSession, isTokenBlacklisted } = require('../utils/jwt');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const session = await getSession(decoded.userId);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      session
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    if (decoded && decoded.type === 'access') {
      const session = await getSession(decoded.userId);
      if (session) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          session
        };
      }
    }

    next();
  } catch (error) {
    next();
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

module.exports = { authenticateToken, optionalAuth, requireAdmin };
