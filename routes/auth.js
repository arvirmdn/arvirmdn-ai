const express = require('express');
const router = express.Router();

// Password gate sederhana — satu password rahasia yang kamu bagikan sendiri ke orang.
// Set di environment variable SITE_PASSWORD (di Railway → tab Variables).

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!process.env.SITE_PASSWORD) {
    return res.status(500).json({ error: 'SITE_PASSWORD belum diset di environment variable server.' });
  }

  if (password === process.env.SITE_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: 'Password salah.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

module.exports = router;
