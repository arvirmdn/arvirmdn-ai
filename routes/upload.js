const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Simpan file dengan NAMA ASLI (tidak diubah).
// Kalau ada nama sama, taruh di subfolder per-timestamp supaya tidak saling timpa,
// tapi nama filenya sendiri tetap persis seperti aslinya.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionDir = path.join(uploadsDir, String(Date.now()));
    fs.mkdirSync(sessionDir, { recursive: true });
    req._sessionDir = sessionDir;
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    // multer default suka mem-decode aneh, pastikan encoding benar & nama asli dipakai apa adanya
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Fungsi bantu: baca isi teks dari buffer (batasi ukuran biar aman utk dikirim ke AI)
function safeReadText(buffer, maxChars = 4000) {
  try {
    const text = buffer.toString('utf8');
    return text.length > maxChars ? text.slice(0, maxChars) + '\n...(dipotong)...' : text;
  } catch {
    return null;
  }
}

const TEXT_EXT = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css',
  '.py', '.java', '.c', '.cpp', '.go', '.rb', '.php', '.yml', '.yaml', '.env', '.sql'];

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diupload' });

  const filePath = req.file.path;
  const originalName = req.file.filename; // sudah nama asli
  const ext = path.extname(originalName).toLowerCase();

  const result = {
    name: originalName,
    size: req.file.size,
    path: filePath, // dipakai lagi utk endpoint /zip-entry
    isZip: ext === '.zip'
  };

  if (ext === '.zip') {
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries().map(e => ({
        entryName: e.entryName,
        isDirectory: e.isDirectory,
        size: e.header.size
      }));
      result.entries = entries;
    } catch (e) {
      result.zipError = 'Gagal membaca isi zip: ' + e.message;
    }
  } else if (TEXT_EXT.includes(ext)) {
    // file teks biasa, langsung sediakan previewnya
    const buf = fs.readFileSync(filePath);
    result.preview = safeReadText(buf);
  }

  res.json(result);
});

// Ambil isi satu file di dalam zip (untuk dibaca AI / preview di UI)
router.post('/zip-entry', express.json(), (req, res) => {
  const { zipPath, entryName } = req.body;
  if (!zipPath || !entryName) return res.status(400).json({ error: 'zipPath & entryName wajib diisi' });
  if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'File zip tidak ditemukan (mungkin sudah dibersihkan server)' });

  try {
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryName);
    if (!entry) return res.status(404).json({ error: 'Entry tidak ditemukan di dalam zip' });
    if (entry.isDirectory) return res.json({ entryName, isDirectory: true, content: null });

    const buffer = entry.getData();
    const content = safeReadText(buffer, 6000);
    res.json({ entryName, isDirectory: false, content: content ?? '(file biner, tidak bisa ditampilkan sebagai teks)' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal membaca entry: ' + e.message });
  }
});

module.exports = router;
