# ARVIRMDN AI Pro — Groq Edition

Asisten AI yang menggabungkan kekuatan **Kimi** (long context & file understanding) dan **Claude** (honest reasoning & anti-hallucination). Pakai Groq API (gratis), bisa upload file & foto, kode langsung jadi ZIP download.

## Fitur Utama
- **Chat AI Pro** — Model Groq (`llama-3.3-70b-versatile`) dengan system prompt khusus anti-halu & detailed reasoning
- **Baca File Apapun** — Upload `.zip`, `.pdf`, `.txt`, `.js`, `.html`, dll. Kalau ZIP, bisa browse isinya dan pilih file yang mau dibaca AI
- **Baca Foto/Gambar** — Upload screenshot error, desain UI, atau dokumen. AI otomatis pakai vision model (`llama-3.2-11b-vision-instruct`)
- **Kode Auto-ZIP** — AI tidak menampilkan kode panjang di chat. Kode otomatis diekstrak jadi file ZIP yang bisa di-download
- **Multi API Key + Fallback** — Bisa pakai beberapa Groq API key sekaligus. Kalau satu kena limit, otomatis pindah ke key berikutnya
- **Password Gate** — Web dilindungi password rahasia

## Jalankan Lokal
```bash
npm install
# Buat file .env di root:
# GROQ_API_KEY=gsk-xxxxxx
# GROQ_MODEL=llama-3.3-70b-versatile
# GROQ_VISION_MODEL=llama-3.2-11b-vision-instruct
# SITE_PASSWORD=password-rahasia
# SESSION_SECRET=string-acak-panjang
# NODE_ENV=development
npm start
```
Buka `http://localhost:3000`.

Dapat API key gratis di https://console.groq.com/keys

## Deploy ke GitHub + Railway

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "ARVIRMDN AI Pro"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

### 2. Deploy di Railway
1. Buka https://railway.app, login pakai GitHub.
2. **New Project** → **Deploy from GitHub repo** → pilih repo ini.
3. Railway otomatis mendeteksi Node.js dan menjalankan `npm install` + `npm start`.
4. Buka tab **Variables**, tambahkan:

| Variable | Value | Wajib? |
|----------|-------|--------|
| `GROQ_API_KEY` | `gsk-xxxxxx` (satu key dari Groq) | ✅ WAJIB |
| `GROQ_API_KEYS` | `gsk-key1,gsk-key2` (beberapa key, fallback otomatis) | ⚠️ Opsional |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | ❌ Opsional |
| `GROQ_VISION_MODEL` | `llama-3.2-11b-vision-instruct` | ❌ Opsional |
| `SITE_PASSWORD` | Password rahasia buat gerbang masuk | ✅ WAJIB |
| `SESSION_SECRET` | String acak panjang untuk enkripsi cookie | ✅ WAJIB |
| `NODE_ENV` | `production` | ❌ Opsional |

5. **Settings → Networking → Generate Domain** → dapat URL publik.

Setiap `git push` ke `main`, Railway otomatis re-deploy.

## Gaya AI (Kimi + Claude Hybrid)

### Anti-Halusinasi (Claude Style)
- AI akan mengatakan "Saya tidak yakin" kalau tidak tahu
- Tidak mengarang fakta, data, atau kode yang tidak ada
- Selalu memeriksa kebenaran sebelum menjawab

### Long Context & File Understanding (Kimi Style)
- Bisa memproses banyak file sekaligus dalam satu percakapan
- Mengingat konteks chat sebelumnya
- Analisis project secara holistik (terutama kalau upload ZIP)

### Code Output Style
- **Tidak** menampilkan kode panjang di chat
- Kode otomatis dijadikan file ZIP yang bisa di-download
- Penjelasan hanya berupa narasi + langkah-langkah

## Catatan
- File upload diproses di memori server (tidak ditulis ke disk) → aman untuk Railway ephemeral filesystem
- Batas upload 20MB per file
- Groq free tier punya rate limit. Kalau kena limit, tunggu beberapa saat atau daftar akun Groq baru untuk API key tambahan.
