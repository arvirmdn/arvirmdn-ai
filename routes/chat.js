const express = require('express');
const AdmZip = require('adm-zip');
const router = express.Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Model gratis Groq yang kuat untuk coding & chat umum
// (llama-3.3-70b-versatile sudah di-deprecate Groq per pertengahan 2026, ganti ke gpt-oss)
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang membantu, jawab dalam bahasa Indonesia kecuali diminta bahasa lain.

ATURAN PENTING soal kode program:
- Kalau kamu perlu menulis atau memberikan kode, JANGAN tulis kodenya sebagai teks biasa di tengah jawaban.
- Bungkus SETIAP file kode dalam blok kode markdown (tanda tiga backtick), dan di baris PERTAMA persis setelah backtick pembuka, tulis nama file atau path-nya saja (contoh: app.js, src/index.py, style.css). Jangan tulis nama bahasa pemrograman di situ, tulis nama filenya.
- Untuk setiap file, cukup satu blok kode saja, jangan diulang di tempat lain.
- Di LUAR blok kode, jelaskan secara ringkas: apa yang dilakukan kodenya, cara menjalankan/memakainya, dan catatan penting lain — tapi jangan tempelkan potongan kode apapun di penjelasan itu, cukup narasi biasa.
- Kalau user tidak minta kode sama sekali, jawab normal seperti biasa tanpa blok kode.`;

// Ubah nama info-string blok kode jadi nama file yang valid & aman
function sanitizeFilename(raw, fallbackExt) {
  let name = (raw || '').trim();
  const looksLikePath = /^[\w./-]+\.[A-Za-z0-9]+$/.test(name);
  if (!looksLikePath) {
    const langMap = {
      js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx',
      python: 'py', py: 'py', html: 'html', css: 'css', json: 'json',
      java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', go: 'go', golang: 'go',
      rb: 'rb', ruby: 'rb', php: 'php', bash: 'sh', sh: 'sh', shell: 'sh',
      yaml: 'yml', yml: 'yml', sql: 'sql', md: 'md', markdown: 'md'
    };
    const ext = langMap[name.toLowerCase()] || fallbackExt || 'txt';
    name = null;
    return { name, ext };
  }
  // cegah path traversal / path absolut
  name = name.replace(/^[/\\]+/, '').replace(/\.\./g, '');
  return { name, ext: null };
}

// Ekstrak semua blok kode dari balasan AI, ganti jadi catatan singkat di teks
function extractCodeFiles(text) {
  const fileRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  const files = [];
  let idx = 0;

  const strippedText = text.replace(fileRegex, (full, info, code) => {
    idx++;
    const { name, ext } = sanitizeFilename(info, 'txt');
    const filename = name || `file-${idx}.${ext}`;
    files.push({ name: filename, content: code });
    return `\n📄 **${filename}** — lihat file zip terlampir\n`;
  });

  return { strippedText: strippedText.trim(), files };
}

router.post('/', async (req, res) => {
  const { messages } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY belum diset di environment variable server.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi (array)' });
  }

  // Selalu pakai system prompt dari server (abaikan system message dari client kalau ada)
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system')
  ];

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const rawReply = data.choices?.[0]?.message?.content || '(tidak ada respons)';
    const { strippedText, files } = extractCodeFiles(rawReply);

    let zipBase64 = null;
    let zipName = null;

    if (files.length > 0) {
      const zip = new AdmZip();
      files.forEach(f => zip.addFile(f.name, Buffer.from(f.content, 'utf8')));
      zipName = files.length === 1
        ? files[0].name.replace(/\.[^./]+$/, '') + '.zip'
        : `kode-${Date.now()}.zip`;
      zipBase64 = zip.toBuffer().toString('base64');
    }

    res.json({
      reply: strippedText || (files.length ? 'Sudah selesai, file kodenya ada di zip terlampir.' : rawReply),
      rawReply,
      files: files.map(f => ({ name: f.name })),
      zipBase64,
      zipName
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menghubungi Groq: ' + e.message });
  }
});

module.exports = router;
