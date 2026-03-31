const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── API ROUTE (must be BEFORE static files) ──────────────────
app.post('/get-answer', async (req, res) => {
  const { question, resume } = req.body;

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key missing. Add ANTHROPIC_API_KEY in Railway Variables.' });
  }

  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const resumeSection = resume && resume.trim()
    ? `\nResume:\n${resume.trim()}\n` : '';

  const prompt = `You are a professional interview assistant.
Answer like a real, confident human candidate.
Keep the answer short (3-5 sentences), clear, professional.
Do NOT use bullet points. Speak naturally.
${resumeSection}
Question: ${question.trim()}

Give a short, confident answer.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || 'Claude API error.' });
    }

    const answer = data?.content?.[0]?.text;
    if (!answer) return res.status(502).json({ error: 'Empty response from Claude.' });

    console.log(`[Q]: ${question}`);
    return res.json({ answer });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── STATIC FILES (after API route) ───────────────────────────
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
