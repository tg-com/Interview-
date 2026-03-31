// ── UPDATED server.js (Safe Version) ──────────────────────────
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const app = express();

// API Key check (Server start hone se pehle check karega)
if (!process.env.CLAUDE_API_KEY) {
  console.error("❌ ERROR: CLAUDE_API_KEY is missing in .env file");
  process.exit(1); 
}

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.post("/get-answer", async (req, res) => {
  try {
    const { question, resume } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({ error: "Sawal likhna zaroori hai!" });
    }

    const systemPrompt = `You are a professional interview assistant. 
    Answer like a real human—concise (3-5 sentences), direct, and genuine. 
    No bullets, no headers. Just natural speech.`;

    const userPrompt = `${resume ? `Resume context: ${resume}\n\n` : ""}Question: ${question}`;

    const message = await client.messages.create({
      // FIXED: Model name updated to a valid one
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // SAFE ACCESS: Agar API khali response de toh crash nahi hoga
    if (message.content && message.content.length > 0) {
      const answer = message.content[0].text;
      res.json({ answer });
    } else {
      throw new Error("AI ne koi text response nahi diya.");
    }

  } catch (err) {
    // Detailed logging for you, but simple message for the user
    console.error("API Error Details:", err.message);
    
    res.status(500).json({ 
      error: "Kuch galat ho gaya. Check karein: 1. API Key, 2. Internet, 3. Model Name." 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));
