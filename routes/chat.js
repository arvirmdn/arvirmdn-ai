const express = require('express');
const AdmZip = require('adm-zip');
const { fetchAihub } = require('./aihubKeys');
const router = express.Router();

const AIHUB_URL = 'https://aihubmix.com/v1/chat/completions';
// Model gratis AIHubMix yang kuat untuk coding & chat umum
const MODEL = process.env.AIHUB_MODEL || 'coding-kimi-k3-free';
// Model khusus yang bisa "melihat" gambar (dipakai otomatis kalau ada foto di pesan)
const VISION_MODEL = process.env.AIHUB_VISION_MODEL || 'claude-opus-5';

// Cek apakah ada gambar di salah satu pesan (content berbentuk array ala format vision)
function hasImageInput(messages) {
  return messages.some(m => Array.isArray(m.content) && m.content.some(part => part.type === 'image_url'));
}

// Ganti tag [BUAT_GAMBAR: deskripsi] dari AI jadi gambar asli via Pollinations.ai (gratis, tanpa API key)
function renderGeneratedImages(text) {
  return text.replace(/\[BUAT_GAMBAR:\s*([^\]]+)\]/gi, (full, desc) => {
    const prompt = desc.trim();
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
    return `![${prompt}](${url})`;
  });
}

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang membantu, jawab dalam bahasa Indonesia kecuali diminta bahasa lain.

ATURAN PALING PENTING — PERBAIKAN BUG / KODE YANG SUDAH ADA:
- Kalau user minta MEMPERBAIKI, MENGUBAH, atau MENYEMPURNAKAN kode/fitur yang sudah ada (bukan bikin dari nol), kamu WAJIB minta user melampirkan kode/file yang relevan (atau tempel isinya) DULU sebelum menulis perbaikan apa pun — KECUALI kode itu sudah ada di riwayat percakapan atau di lampiran pesan ini. JANGAN menebak-nebak atau menulis ulang kode dari ingatan/asumsi.
- Kalau kode yang relevan SUDAH tersedia (dari lampiran atau chat sebelumnya): baca dan pahami dulu alur logikanya secara menyeluruh sebelum mengubah apa pun. Jangan langsung asal ganti.
- Lakukan perubahan SEMINIMAL MUNGKIN untuk menyelesaikan permintaan. JANGAN menulis ulang seluruh file dari nol, JANGAN mengubah/menghapus bagian yang tidak diminta dan tidak berhubungan dengan masalahnya, walau menurutmu bagian itu bisa "dirapikan".
- Kalau kamu memberi ulang file yang sudah ada, pastikan SEMUA fungsi/fitur lain yang sebelumnya sudah jalan tetap ada persis seperti semula — cuma bagian yang memang diminta diubah yang boleh berbeda.
- Sebelum menjawab, cek ulang logikanya dalam pikiranmu: apakah perubahan ini benar-benar menyebabkan efek yang diminta, dan apakah ada kemungkinan itu malah merusak bagian lain (misal: mengubah CSS animasi tapi lupa ada elemen lain yang pakai class yang sama, atau mengubah urutan kode yang ternyata dependen). Kalau ragu, katakan terus terang apa yang tidak kamu yakini, jangan asal comot jawaban.
- Kalau permintaan user ambigu atau informasinya kurang (misal cuma bilang "animasinya rusak" tanpa detail rusaknya seperti apa atau kode yang mana), tanyakan dulu detailnya sebelum menulis kode — jangan asal menebak dan menghasilkan kode yang belum tentu benar.

ATURAN PENTING soal kode program:
- Kalau kamu perlu menulis atau memberikan kode, JANGAN tulis kodenya sebagai teks biasa di tengah jawaban.
- Bungkus SETIAP file kode dalam blok kode markdown (tanda tiga backtick), dan di baris PERTAMA persis setelah backtick pembuka, tulis nama file atau path-nya saja (contoh: app.js, src/index.py, style.css). Jangan tulis nama bahasa pemrograman di situ, tulis nama filenya.
- Untuk setiap file, cukup satu blok kode saja, jangan diulang di tempat lain.
- Di LUAR blok kode, jelaskan secara ringkas: apa yang dilakukan kodenya, cara menjalankan/memakainya, dan catatan penting lain — tapi jangan tempelkan potongan kode apapun di penjelasan itu, cukup narasi biasa.
- Kalau user tidak minta kode sama sekali, jawab normal seperti biasa tanpa blok kode.

GAYA MENJELASKAN:
- Jangan cuma kasih jawaban akhir atau kode mentah — jelaskan juga LOGIKA di baliknya secara singkat, seolah mengajari orang yang baru belajar.
- Kalau ada langkah-langkah (misal cara pasang, cara pakai, cara ganti sesuatu), tulis sebagai daftar bernomor (1, 2, 3, ...), bukan paragraf panjang.
- Kalau memungkinkan, sertakan satu contoh sederhana dan konkret (nama file, potongan kecil kode, atau skenario nyata) supaya orang awam gampang membayangkannya — hindari penjelasan yang terlalu abstrak/teoretis.
- Gunakan bahasa yang santai, jelas, dan tidak bertele-tele. Hindari istilah teknis tanpa penjelasan singkat artinya.
- Kalau menjelaskan perbaikan bug, sebutkan singkat APA penyebabnya sebelum menjelaskan cara memperbaikinya, supaya user paham "kenapa"-nya, bukan cuma "apa"-nya.

ATURAN MEMBUAT GAMBAR:
- Kalau user minta kamu MEMBUATKAN/MENGHASILKAN gambar, ilustrasi, foto, atau logo (bukan menganalisa foto yang dia kirim), kamu BISA melakukannya.
- Caranya: tulis satu baris khusus persis dengan format ini: [BUAT_GAMBAR: deskripsi gambar dalam bahasa Inggris, singkat dan jelas]
- Kalau user minta beberapa gambar berbeda, tulis beberapa baris tag seperti itu.
- Jangan menulis markdown gambar (![]()) sendiri dan jangan taruh tag itu di dalam blok kode — biarkan sistem yang mengubahnya jadi gambar asli.
- Di luar baris tag itu, boleh kasih penjelasan singkat seperti biasa.
- Kalau user mengirim/upload foto dan minta dijelaskan isinya, itu bukan permintaan membuat gambar — cukup jelaskan isi fotonya dengan teks biasa.`;

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
  name = name.replace(/^[\/\\]+/, '').replace(/\.\./g, '');
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

  if (!process.env.AIHUB_API_KEYS && !process.env.AIHUB_API_KEY) {
    return res.status(500).json({ error: 'AIHUB_API_KEYS (atau AIHUB_API_KEY) belum diset di environment variable server.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi (array)' });
  }

  // Selalu pakai system prompt dari server (abaikan system message dari client kalau ada)
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system')
  ];

  const model = hasImageInput(fullMessages) ? VISION_MODEL : MODEL;

  try {
    const aihubRes = await fetchAihub(AIHUB_URL, {
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: false
    });

    const data = aihubRes.data;

    if (!aihubRes.ok) {
      return res.status(aihubRes.status).json({ error: data.error?.message || 'AIHubMix API error' });
    }

    const rawReplyFromModel = data.choices?.[0]?.message?.content || '(tidak ada respons)';
    const rawReply = renderGeneratedImages(rawReplyFromModel);
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
    res.status(500).json({ error: 'Gagal menghubungi AIHubMix: ' + e.message });
  }
});

module.exports = router;
