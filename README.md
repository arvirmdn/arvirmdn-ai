# Web AI Chat

Chat AI ala Claude, pakai Groq API (gratis), bisa upload file — termasuk `.zip` — dan membaca isinya, nama file tidak diubah sama sekali.

## Fitur
- Chat dengan AI (model default: `openai/gpt-oss-120b` via Groq, bisa diganti lewat env `GROQ_MODEL`)
- Upload file apapun, disimpan dengan **nama file asli**
- Kalau yang diupload `.zip`: otomatis menampilkan daftar isi zip, dan kamu bisa klik file di dalamnya untuk dibaca isinya lalu disertakan ke pesan ke AI
- Tanpa login (bisa ditambah nanti kalau perlu)

## Jalankan lokal
```bash
npm install
cp .env.example .env
# edit .env, isi GROQ_API_KEY
npm start
```
Buka `http://localhost:3000`.

Dapat API key gratis di https://console.groq.com/keys

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
   - `GROQ_API_KEY` = api key kamu dari Groq
   - `GROQ_MODEL` = `openai/gpt-oss-120b` (opsional, ini sudah default)
5. Railway akan kasih domain publik otomatis (bagian **Settings → Networking → Generate Domain**). Klik itu, tunggu build selesai, lalu buka domainnya.

Setiap kali kamu `git push` ke `main`, Railway otomatis re-deploy.

## Catatan penting
- File upload diproses langsung di **memori server** (tidak ditulis ke disk), lalu isinya (kalau zip/teks) dikirim balik ke browser dalam satu kali request. Ini menghindari masalah *ephemeral filesystem* Railway (file hilang tiap redeploy) dan membuat fitur baca-isi-zip lebih andal.
- Batas ukuran file upload saat ini 20MB per file (bisa diubah di `routes/upload.js`, bagian `limits.fileSize`).
- Bisa upload **beberapa file sekaligus** dalam satu pesan — setiap file jadi lampiran terpisah, isinya (kalau teks/zip) otomatis disertakan ke konteks yang dikirim ke AI.
- Model Groq yang dipakai gratis dan cepat, tapi ada rate limit dari Groq — kalau kena limit, tunggu beberapa saat atau ganti model di `.env`.

## Struktur proyek
```
web-ai-chat/
├── server.js           # entry point Express
├── routes/
│   ├── chat.js          # proxy ke Groq API
│   └── upload.js        # handle upload file & baca isi zip
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── uploads/              # tempat file yang diupload (sementara)
├── .env.example
└── package.json
```
