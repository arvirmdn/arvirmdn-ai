require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.set('trust proxy', 1); // perlu di Railway (di belakang proxy) supaya cookie secure jalan benar

app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti-secret-ini-di-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 hari
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

app.use('/auth', require('./routes/auth'));

// Halaman login & asetnya sendiri boleh diakses tanpa login
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Gerbang: semua route di bawah ini wajib sudah login dulu
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();

  // Kalau request API (bukan buka halaman), balas JSON 401 bukan redirect
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Belum login.' });
  }

  return res.redirect('/login.html');
}

app.use(requireAuth);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/upload', require('./routes/upload'));
app.use('/api/chat', require('./routes/chat'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});
