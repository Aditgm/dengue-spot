const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, storeSession } = require('../utils/jwt');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/oauth/google/callback',
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const name = profile.displayName;
          const googleId = profile.id;
          const avatar = profile.photos?.[0]?.value;

          // Check if user exists by googleId or email in MongoDB
          let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

          if (user) {
            // Link Google account if user exists by email but not yet linked
            if (!user.googleId) {
              user.googleId = googleId;
              user.provider = 'google';
              if (avatar && !user.avatar) user.avatar = avatar;
              user.isEmailVerified = true; // Google emails are verified
              await user.save();
            }
            if (user.isBanned) {
              return done(null, false, { message: 'Your account has been banned' });
            }
          } else {
            user = await User.create({
              name,
              email: email.toLowerCase(),
              googleId,
              avatar,
              provider: 'google',
              isEmailVerified: true,
              password: `Google_${googleId}_${Date.now()}`
            });
          }
          user.lastLoginIp = req.ip || req.connection?.remoteAddress;

          const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'arajsinha4@gmail.com').toLowerCase();
          if (user.email === SUPER_ADMIN_EMAIL && user.role !== 'admin') {
            user.role = 'admin';
          }
          await user.save();

          const userId = user._id.toString();
          const jwtAccessToken = generateAccessToken(userId, user.email);
          const jwtRefreshToken = generateRefreshToken(userId, user.email);

          await storeSession(userId, {
            userId,
            email: user.email,
            name: user.name,
            provider: 'google',
            loginAt: new Date().toISOString()
          });

          // Attach tokens and public data to user object for the callback
          const userData = user.toPublicJSON();
          userData.accessToken = jwtAccessToken;
          userData.refreshToken = jwtRefreshToken;

          return done(null, userData);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
} else {
  console.log('⚠️  Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env');
}

module.exports = passport;
