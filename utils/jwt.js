const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const generateRefreshToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
};

const storeSession = async (userId, sessionData, expiresIn = 86400) => {
  try {
    const key = `session:${userId}`;
    await redisClient.setex(
      key,
      expiresIn,
      JSON.stringify(sessionData)
    );
    return true;
  } catch (error) {
    console.error('Error storing session:', error);
    return false;
  }
};

const getSession = async (userId) => {
  try {
    const key = `session:${userId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

const deleteSession = async (userId) => {
  try {
    const key = `session:${userId}`;
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
};

const blacklistToken = async (token, expiresIn = 86400) => {
  try {
    const key = `blacklist:${token}`;
    await redisClient.setex(key, expiresIn, 'true');
    return true;
  } catch (error) {
    console.error('Error blacklisting token:', error);
    return false;
  }
};

const isTokenBlacklisted = async (token) => {
  try {
    const key = `blacklist:${token}`;
    const result = await redisClient.get(key);
    return result !== null;
  } catch (error) {
    console.error('Error checking blacklist:', error);
    return false;
  }
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  storeSession,
  getSession,
  deleteSession,
  blacklistToken,
  isTokenBlacklisted,
  verifyToken
};
