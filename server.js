// ─────────────────────────────────────────────
//  AI Interview Assistant — server.js
//  Node.js + Express backend
// ─────────────────────────────────────────────
const express  = require("express");
const cors     = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const app    = express();
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serves index.html

// ── POST /get-answer ──────────────────────────
app.post("/get-answer", async (req, res) => {
  const { question, resume } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  const systemPrompt = `You are a professional interview assistant helping a candidate answer interview questions naturally and confidently.
Answer like a real human candidate — concise, direct, and genuine.
Keep answers to 3–5 sentences. No bullet points. No headers. Just a natural spoken response.`;

  const userPrompt = `${resume ? `Candidate Resume:\n${resume}\n\n` : ""}Question: ${question}

Give a short, confident, natural answer as if speaking out loud.`;

  try {
    const message = await client.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const answer = message.content[0].text;
    res.json({ answer });
  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(500).json({ error: "Failed to get AI response. Check your API key." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
