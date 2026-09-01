# Web AI Chat — AIHubMix Edition

Chat AI ala Claude, pakai **AIHubMix API**, bisa upload file — termasuk `.zip` — dan membaca isinya, nama file tidak diubah sama sekali.

## Fitur
- Chat dengan AI (model default: `coding-kimi-k3-free` via AIHubMix, bisa diganti lewat env `AIHUB_MODEL`)
- Upload file apapun, disimpan dengan **nama file asli**
- Kalau yang diupload `.zip`: otomatis menampilkan daftar isi zip, dan kamu bisa klik file di dalamnya untuk dibaca isinya lalu disertakan ke pesan ke AI
- Password gate sederhana (1 password rahasia)
- Support multi API key dengan **fallback otomatis** — kalau satu key kena limit/error, server otomatis pindah ke key berikutnya

## Jalankan lokal
```bash
npm install
# Buat file .env di root, isi:
# AIHUB_API_KEY=sk-xxxxxx
# AIHUB_MODEL=coding-kimi-k3-free
# SITE_PASSWORD=password-rahasia-kamu
# SESSION_SECRET=string-acak-panjang
# NODE_ENV=development
npm start
```
Buka `http://localhost:3000`.

Dapat API key gratis di https://aihubmix.com → Sign Up → API Keys → Create Key

## Deploy ke GitHub + Railway

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

### 2. Deploy di Railway
1. Buka https://railway.app, login pakai GitHub.
2. Klik **New Project** → **Deploy from GitHub repo** → pilih repo ini.
3. Railway otomatis mendeteksi Node.js dan menjalankan `npm install` + `npm start`.
4. Buka tab **Variables** di project Railway, tambahkan:

| Variable | Value | Wajib? |
|----------|-------|--------|
| `AIHUB_API_KEY` | `sk-xxxxxx` (satu key dari AIHubMix) | ✅ WAJIB |
| `AIHUB_API_KEYS` | `sk-key1,sk-key2,sk-key3` (beberapa key, fallback otomatis) | ⚠️ Opsional (kalau punya banyak key) |
| `AIHUB_MODEL` | `coding-kimi-k3-free` | ❌ Opsional (default: coding-kimi-k3-free) |
| `AIHUB_VISION_MODEL` | `claude-opus-5` | ❌ Opsional (default: claude-opus-5) |
| `SITE_PASSWORD` | Password rahasia buat gerbang masuk web | ✅ WAJIB |
| `SESSION_SECRET` | String acak panjang untuk enkripsi cookie | ✅ WAJIB |
| `NODE_ENV` | `production` | ❌ Opsional (biar cookie lebih aman) |

5. Railway akan kasih domain publik otomatis (bagian **Settings → Networking → Generate Domain**). Klik itu, tunggu build selesai, lalu buka domainnya.

Setiap kali kamu `git push` ke `main`, Railway otomatis re-deploy.

## Model yang Tersedia di AIHubMix (Gratis & Berbayar)

| Model | Keterangan | Harga |
|-------|-----------|-------|
| `coding-kimi-k3-free` | Kimi K3, khusus coding, gratis | 🆓 Gratis |
| `claude-opus-5` | Claude terbaru, sangat pintar | 💰 Berbayar |
| `gpt-4o` | GPT-4o OpenAI | 💰 Berbayar |
| `deepseek-v3` | DeepSeek V3 | 💰 Berbayar |

> 💡 **Tips**: Kalau mau gratis total, pakai `coding-kimi-k3-free`. Kalau mau model paling pintar dan tidak keberatan bayar, pakai `claude-opus-5`.

## Catatan penting
- File upload diproses langsung di **memori server** (tidak ditulis ke disk), lalu isinya (kalau zip/teks) dikirim balik ke browser dalam satu kali request. Ini menghindari masalah *ephemeral filesystem* Railway (file hilang tiap redeploy) dan membuat fitur baca-isi-zip lebih andal.
- Batas ukuran file upload saat ini 20MB per file (bisa diubah di `routes/upload.js`, bagian `limits.fileSize`).
- Bisa upload **beberapa file sekaligus** dalam satu pesan — setiap file jadi lampiran terpisah, isinya (kalau teks/zip) otomatis disertakan ke konteks yang dikirim ke AI.
- AIHubMix menggunakan format API OpenAI-compatible, jadi struktur request/response sama persis dengan Groq/OpenAI.

## Struktur proyek
```
web-ai-chat/
├── server.js              # entry point Express
├── package.json
├── .env                   # environment variables (jangan di-push ke GitHub!)
├── public/
│   ├── index.html         # UI chat
│   ├── login.html         # Halaman login
│   ├── script.js          # Logic frontend
│   └── style.css          # Styling
├── routes/
│   ├── auth.js            # Login/logout
│   ├── chat.js            # Handler chat ke AIHubMix API
│   ├── aihubKeys.js       # Multi-key fallback logic
│   └── upload.js          # Handler upload file
└── uploads/               # Folder upload (di Railway ephemeral)
```
