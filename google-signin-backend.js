const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const mongoose = require('mongoose');
const User = require('./models/User'); // Assuming User model is in models/User.js or adjust accordingly

const router = express.Router();
const client = new OAuth2Client('YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'); // Replace with your Google client ID

// POST /google-signin
router.post('/google-signin', async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) {
    return res.status(400).json({ success: false, message: 'ID token is required' });
  }

  try {
    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your Google client ID
    });
    const payload = ticket.getPayload();

    // Extract user info
    const { sub, email, given_name, family_name } = payload;

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      // Create new user with random password or mark as Google user
      user = new User({
        firstName: given_name || '',
        lastName: family_name || '',
        email,
        phone: '',
        address: '',
        password: '', // No password since Google sign-in
      });
      await user.save();
    }

    // Respond with success and user info
    res.json({ success: true, user: { firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (error) {
    console.error('Google Sign-In verification error:', error);
    res.status(401).json({ success: false, message: 'Invalid ID token' });
  }
});

module.exports = router;
