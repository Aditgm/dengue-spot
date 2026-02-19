const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/login?error=google_auth_failed' 
  }),
  (req, res) => {
    const { accessToken, refreshToken, id, name, email, avatar } = req.user;
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendURL}/auth/callback?` +
      `access_token=${encodeURIComponent(accessToken)}&` +
      `refresh_token=${encodeURIComponent(refreshToken)}&` +
      `user=${encodeURIComponent(JSON.stringify({ id, name, email, avatar }))}`
    );
  }
);

// GitHub OAuth - placeholder
router.get('/github', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'GitHub OAuth not yet implemented'
  });
});

router.get('/facebook', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Facebook OAuth not yet implemented'
  });
});

module.exports = router;
