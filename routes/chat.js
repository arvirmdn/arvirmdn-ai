const express = require('express');
const router = express.Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Model gratis Groq yang kuat untuk coding & chat umum
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

router.post('/', async (req, res) => {
  const { messages } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY belum diset di environment variable server.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi (array)' });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const reply = data.choices?.[0]?.message?.content || '(tidak ada respons)';
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menghubungi Groq: ' + e.message });
  }
});

module.exports = router;
