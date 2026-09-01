// Helper untuk memanggil AIHubMix API dengan beberapa API key + fallback otomatis.
// Kalau satu key gagal (rate limit / invalid / server error), otomatis coba key berikutnya.

// Ambil semua key dari AIHUB_API_KEYS (dipisah koma). Kalau belum diset,
// tetap dukung AIHUB_API_KEY lama (single key) supaya tidak breaking changes.
function loadApiKeys() {
  const multi = (process.env.AIHUB_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (multi.length > 0) return multi;

  if (process.env.AIHUB_API_KEY) return [process.env.AIHUB_API_KEY.trim()];

  return [];
}

let currentKeyIndex = 0;

/**
 * Kirim POST ke AIHubMix API. Otomatis pindah ke API key berikutnya kalau key
 * yang sedang dipakai kena rate limit (429) atau invalid (401/403).
 * Melempar Error kalau semua key sudah dicoba dan gagal semua.
 */
async function fetchAihub(url, payload) {
  const apiKeys = loadApiKeys();

  if (apiKeys.length === 0) {
    throw new Error('AIHUB_API_KEYS atau AIHUB_API_KEY belum diset di environment variable server.');
  }

  let lastErrorMessage = 'Tidak diketahui';
  let lastStatus = 500;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        currentKeyIndex = keyIndex; // key ini berhasil, pakai lagi duluan di request berikutnya
        return { ok: true, status: response.status, data };
      }

      lastErrorMessage = data.error?.message || `AIHubMix API error ${response.status}`;
      lastStatus = response.status;

      // Kalau errornya soal key (limit/invalid), coba key berikutnya. Kalau bukan, langsung berhenti.
      if ([429, 401, 403].includes(response.status) && attempt < apiKeys.length - 1) {
        console.warn(`AIHubMix key #${keyIndex + 1} gagal (status ${response.status}), coba key berikutnya...`);
        continue;
      }

      return { ok: false, status: response.status, data };
    } catch (e) {
      lastErrorMessage = e.message;
      console.warn(`AIHubMix key #${keyIndex + 1} error jaringan:`, e.message);
      continue;
    }
  }

  return { ok: false, status: lastStatus, data: { error: { message: lastErrorMessage } } };
}

module.exports = { fetchAihub };
