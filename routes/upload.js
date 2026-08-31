const express = require('express');
const multer = require('multer');
const path = require('path');
const AdmZip = require('adm-zip');

const router = express.Router();

// Simpan di MEMORI (bukan disk) supaya jalan di lingkungan serverless (Vercel)
// maupun server biasa (Railway) tanpa bergantung pada filesystem yang persisten.
// Nama file ASLI tetap dipertahankan apa adanya, cuma tidak ditulis ke disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB (Vercel keras batasi request body ~4.5MB, lihat README)
});

const TEXT_EXT = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css',
  '.py', '.java', '.c', '.cpp', '.go', '.rb', '.php', '.yml', '.yaml', '.env', '.sql'];

const MAX_ENTRY_BYTES = 200 * 1024; // file teks di dalam zip yang lebih besar dari ini tidak otomatis dibaca
const MAX_PREVIEW_CHARS = 4000;

function safeReadText(buffer, maxChars = MAX_PREVIEW_CHARS) {
  try {
    const text = buffer.toString('utf8');
    return text.length > maxChars ? text.slice(0, maxChars) + '\n...(dipotong)...' : text;
  } catch {
    return null;
  }
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diupload' });

  // multer default suka mem-decode aneh, pastikan encoding benar & nama asli dipakai apa adanya
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(originalName).toLowerCase();
  const buffer = req.file.buffer;

  const result = {
    name: originalName,
    size: req.file.size,
    isZip: ext === '.zip'
  };

  if (ext === '.zip') {
    try {
      const zip = new AdmZip(buffer);
      result.entries = zip.getEntries().map(e => {
        const entry = {
          entryName: e.entryName,
          isDirectory: e.isDirectory,
          size: e.header.size
        };
        const entryExt = path.extname(e.entryName).toLowerCase();
        // Langsung baca isi file teks yang wajar ukurannya, di sini juga (satu kali request),
        // supaya tidak perlu simpan file zip-nya untuk request susulan.
        if (!e.isDirectory && TEXT_EXT.includes(entryExt) && e.header.size > 0 && e.header.size <= MAX_ENTRY_BYTES) {
          entry.content = safeReadText(e.getData(), 6000);
        }
        return entry;
      });
    } catch (e) {
      result.zipError = 'Gagal membaca isi zip: ' + e.message;
    }
  } else if (TEXT_EXT.includes(ext)) {
    result.preview = safeReadText(buffer);
  }

  res.json(result);
});

module.exports = router;
