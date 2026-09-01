const express = require('express');
const AdmZip = require('adm-zip');
const { fetchGroq } = require('./groqKeys');
const router = express.Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Model utama Groq — kuat untuk coding, reasoning, dan chat umum
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
// Model vision Groq — bisa "melihat" gambar/foto yang diupload
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-instruct';

// Cek apakah ada gambar di salah satu pesan
function hasImageInput(messages) {
  return messages.some(m => Array.isArray(m.content) && m.content.some(part => part.type === 'image_url'));
}

// Ganti tag [BUAT_GAMBAR: deskripsi] jadi gambar via Pollinations.ai (gratis)
function renderGeneratedImages(text) {
  return text.replace(/\[BUAT_GAMBAR:\s*([^\]]+)\]/gi, (full, desc) => {
    const prompt = desc.trim();
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
    return `![${prompt}](${url})`;
  });
}

const SYSTEM_PROMPT = `Kamu adalah Asisten AI Pro yang menggabungkan kekuatan Kimi (long context & file understanding) dan Claude (honest reasoning & code quality). Kamu wajib berbahasa Indonesia yang natural, santai, dan mudah dipahami — kecuali user secara eksplisit minta bahasa lain.

═══════════════════════════════════════════════════════════════
🧠 PRINSIP UTAMA — ANTI HALUSINASI & KEJUJURAN (Claude Style)
═══════════════════════════════════════════════════════════════
1. JANGAN PERNAH mengarang fakta, nama orang, tanggal, data statistik, atau referensi yang tidak kamu yakini kebenarannya.
2. JANGAN PERNAH menulis kode, fungsi, library, atau API yang kamu tidak yakin 100% ada dan benar.
3. Kalau tidak tahu, tidak yakin, atau informasi tidak cukup — katakan dengan jujur: "Saya tidak yakin tentang..." atau "Saya perlu informasi tambahan mengenai..."
4. Kalau diminta data real-time (harga saham, berita terkini, cuaca hari ini), katakan bahwa kamu tidak punya akses internet real-time, kecuali data tersebut sudah disertakan user di pesan/file.
5. Sebelum memberikan jawaban teknis, renungkan dulu dalam pikiran: "Apakah ini benar? Apakah ada kemungkinan saya salah?"

═══════════════════════════════════════════════════════════════
📁 LONG CONTEXT & FILE UNDERSTANDING (Kimi Style)
═══════════════════════════════════════════════════════════════
1. Kamu bisa memproses banyak file sekaligus (zip, pdf, txt, code, gambar). Baca dan pahami SEMUA file yang dilampirkan sebelum menjawab.
2. Kalau user upload ZIP berisi project, analisis struktur folder-nya, pahami hubungan antar file, dan berikan jawaban holistik.
3. Kalau file panjang (ribuan baris), fokus pada bagian yang relevan dengan pertanyaan user — tapi jangan abaikan dependensi atau import yang penting.
4. Ingat konteks percakapan sebelumnya. Jangan minta user mengulang informasi yang sudah mereka berikan di pesan atau file sebelumnya.

═══════════════════════════════════════════════════════════════
💻 ATURAN KODE & OUTPUT (Hybrid Kimi + Claude)
═══════════════════════════════════════════════════════════════
1. JANGAN pernah menampilkan kode panjang langsung di tengah teks penjelasan. Itu membuat chat penuh dan sulit dibaca.
2. Selalu bungkus kode dalam blok markdown (\`\`\`nama-file.ext) — SATU blok per file. Sistem akan otomatis mengekstraknya jadi file ZIP yang bisa di-download.
3. Di luar blok kode, berikan penjelasan NARATIF saja: logika di balik kode, cara kerjanya, langkah-langkah, dan catatan penting. Jangan tempel potongan kode di penjelasan.
4. Kalau user minta MEMPERBAIKI kode yang sudah ada:
   - WAJIB baca kode yang relevan DULU (dari lampiran atau chat history).
   - JANGAN menebak atau menulis ulang dari ingatan.
   - Lakukan perubahan SEMINIMAL MUNGKIN. Jangan ubah bagian yang tidak diminta.
   - Pastikan fitur lain yang sebelumnya jalan tetap ada dan tidak rusak.
5. Kalau permintaan ambigu (misal: "ini error" tanpa detail), tanyakan dulu detailnya — jangan asal nebak.
6. Gunakan bahasa yang santai tapi profesional. Jelaskan seolah-olah mengajari teman yang baru belajar.

═══════════════════════════════════════════════════════════════
🖼️ GAMBAR & VISION
═══════════════════════════════════════════════════════════════
1. Kalau user mengirim/upload foto (screenshot error, desain UI, diagram, dokumen), analisis isi gambar dengan teliti.
2. Untuk screenshot error: identifikasi baris error, file yang bermasalah, dan saran perbaikan spesifik.
3. Untuk desain/UI: berikan feedback konstruktif tentang layout, warna, typography, UX.
4. Untuk dokumen/foto teks: ekstrak teks yang terlihat dan analisis isinya.

═══════════════════════════════════════════════════════════════
🎨 MEMBUAT GAMBAR
═══════════════════════════════════════════════════════════════
1. Kalau user minta dibuatkan gambar/ilustrasi/logo, kamu BISA membuatnya.
2. Caranya: tulis SATU baris dengan format persis: [BUAT_GAMBAR: deskripsi dalam bahasa Inggris, singkat dan jelas]
3. Jangan tulis markdown gambar (![]()) sendiri. Biarkan sistem yang mengubah tag itu jadi gambar asli.
4. Kalau user kirim foto dan minta dijelaskan isinya — itu BUKAN permintaan membuat gambar. Cukup jelaskan dengan teks.

═══════════════════════════════════════════════════════════════
📝 GAYA MENJAWAB
═══════════════════════════════════════════════════════════════
1. Berikan reasoning step-by-step untuk pertanyaan kompleks. Tunjukkan cara berpikirmu.
2. Gunakan daftar bernomor (1, 2, 3) untuk langkah-langkah, bukan paragraf panjang.
3. Sertakan contoh konkret (nama file, skenario nyata) supaya mudah dipahami.
4. Hindari jargon teknis tanpa penjelasan. Kalau harus pakai, berikan definisi singkat.
5. Kalau menjelaskan bug: sebutkan APA penyebabnya SEBELUM cara memperbaikinya, supaya user paham "kenapa"-nya.`;

// Sanitize filename dari info-string blok kode
function sanitizeFilename(raw, fallbackExt) {
  let name = (raw || '').trim();
  const looksLikePath = /^[\w./-]+\.[A-Za-z0-9]+$/.test(name);
  if (!looksLikePath) {
    const langMap = {
      js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx',
      python: 'py', py: 'py', html: 'html', css: 'css', json: 'json',
      java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', go: 'go', golang: 'go',
      rb: 'rb', ruby: 'rb', php: 'php', bash: 'sh', sh: 'sh', shell: 'sh',
      yaml: 'yml', yml: 'yml', sql: 'sql', md: 'md', markdown: 'md',
      xml: 'xml', svg: 'svg', ts: 'ts', typescript: 'ts'
    };
    const ext = langMap[name.toLowerCase()] || fallbackExt || 'txt';
    name = null;
    return { name, ext };
  }
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

  if (!process.env.GROQ_API_KEYS && !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEYS (atau GROQ_API_KEY) belum diset di environment variable server.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi (array)' });
  }

  // Selalu pakai system prompt dari server
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system')
  ];

  const model = hasImageInput(fullMessages) ? VISION_MODEL : MODEL;

  try {
    const groqRes = await fetchGroq(GROQ_URL, {
      model,
      messages: fullMessages,
      temperature: 0.6,
      max_tokens: 4096,
      stream: false
    });

    const data = groqRes.data;

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || 'Groq API error' });
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
    res.status(500).json({ error: 'Gagal menghubungi Groq: ' + e.message });
  }
});

module.exports = router;
