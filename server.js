const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── STARTUP CHECK ────────────────────────────────────────────
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌ ERROR: ANTHROPIC_API_KEY is missing!');
  console.error('Railway Variables mein ANTHROPIC_API_KEY add karo.');
  process.exit(1);
}

console.log('✅ API Key found! Starting server...');

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── MAIN API ─────────────────────────────────────────────────
app.post('/get-answer', async (req, res) => {
  const { question, resume } = req.body;

  if (!question || question.trim() === '') {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const resumeSection = resume && resume.trim()
    ? `Resume:\n${resume.trim()}\n\n`
    : '';

  const prompt = `You are a professional interview assistant.
Answer like a real, confident human candidate in an interview.
Keep the answer short (3-5 sentences), clear, and professional.
Do NOT use bullet points. Speak naturally.

${resumeSection}Question:
${question.trim()}

Give a short, confident, and personalized answer.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(502).json({
        error: errData?.error?.message || 'Claude API error.'
      });
    }

    const data   = await response.json();
    const answer = data?.content?.[0]?.text;

    if (!answer) {
      return res.status(502).json({ error: 'Empty response from Claude.' });
    }

    console.log(`[Q]: ${question}`);
    return res.json({ answer });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── FALLBACK ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
