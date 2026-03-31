import { useState, useRef, useEffect, useCallback } from "react";

// ─── Utility ────────────────────────────────────────────────────────────────
const callClaude = async (question, resume) => {
  const systemPrompt = `You are a professional interview assistant helping a candidate answer interview questions naturally and confidently.
Answer like a real human candidate would — concise, direct, and genuine.
Keep answers to 3-5 sentences maximum. No bullet points. No headers. Just a natural spoken response.`;

  const userPrompt = `${resume ? `Candidate Resume:\n${resume}\n\n` : ""}Question: ${question}

Give a short, confident, natural answer as if speaking out loud.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.content[0].text;
};

// ─── Waveform bars (visual only) ────────────────────────────────────────────
const WaveBar = ({ delay, active }) => (
  <div
    style={{
      animationDelay: delay,
      animationPlayState: active ? "running" : "paused",
    }}
    className={`wave-bar ${active ? "opacity-100" : "opacity-30"}`}
  />
);

const Waveform = ({ active }) => (
  <div className="flex items-center gap-[3px] h-8">
    {[...Array(16)].map((_, i) => (
      <WaveBar key={i} delay={`${i * 0.07}s`} active={active} />
    ))}
  </div>
);

// ─── Status badge ────────────────────────────────────────────────────────────
const STATUS = {
  idle:      { label: "Ready",      color: "#4ade80", icon: "◉" },
  listening: { label: "Listening",  color: "#f59e0b", icon: "◎" },
  thinking:  { label: "Thinking",   color: "#60a5fa", icon: "◌" },
  done:      { label: "Answer Ready", color: "#a78bfa", icon: "◍" },
  error:     { label: "Error",      color: "#f87171", icon: "◈" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.idle;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: `${s.color}15`, border: `1px solid ${s.color}40` }}>
      <span className={`text-sm ${status === "thinking" || status === "listening" ? "animate-pulse" : ""}`} style={{ color: s.color }}>
        {s.icon}
      </span>
      <span className="text-xs font-mono tracking-widest uppercase" style={{ color: s.color }}>
        {s.label}
      </span>
    </div>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────
export default function AIInterviewAssistant() {
  const [status, setStatus]         = useState("idle");
  const [question, setQuestion]     = useState("");
  const [answer, setAnswer]         = useState("");
  const [resume, setResume]         = useState("");
  const [resumeName, setResumeName] = useState("");
  const [history, setHistory]       = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError]           = useState("");

  const recognitionRef  = useRef(null);
  const answerBoxRef    = useRef(null);
  const silenceTimer    = useRef(null);

  // ── Init speech recognition ──────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);

      // Reset silence timer on every new result
      clearTimeout(silenceTimer.current);
      if (final) {
        setQuestion(final);
        silenceTimer.current = setTimeout(() => {
          rec.stop();
        }, 1200);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      const q = recognitionRef.current?._lastQuestion;
      if (q) triggerAnswer(q);
    };

    rec.onerror = (e) => {
      setIsListening(false);
      setStatus("error");
      setError(e.error === "not-allowed" ? "Microphone access denied." : `Speech error: ${e.error}`);
    };

    recognitionRef.current = rec;
    return () => clearTimeout(silenceTimer.current);
  }, []);

  // Store latest question in ref so onend can access it
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current._lastQuestion = question;
  }, [question]);

  // ── Trigger Claude answer ─────────────────────────────────────────────────
  const triggerAnswer = useCallback(async (q) => {
    if (!q?.trim()) return;
    setError("");
    setStatus("thinking");
    setAnswer("");
    try {
      const result = await callClaude(q, resume);
      setAnswer(result);
      setHistory(prev => [{ question: q, answer: result, ts: Date.now() }, ...prev.slice(0, 9)]);
      setStatus("done");
    } catch (err) {
      setError(err.message || "Failed to get answer.");
      setStatus("error");
    }
  }, [resume]);

  // Scroll answer into view
  useEffect(() => {
    if (answer && answerBoxRef.current) {
      answerBoxRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [answer]);

  // ── Mic toggle ───────────────────────────────────────────────────────────
  const toggleMic = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatus("idle");
    } else {
      setQuestion("");
      setTranscript("");
      setAnswer("");
      setError("");
      setStatus("listening");
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // ── Resume upload ────────────────────────────────────────────────────────
  const handleResume = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) { setError("Only .txt files supported."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setResume(ev.target.result); setResumeName(file.name); };
    reader.readAsText(file);
  };

  // ── Manual question submit ───────────────────────────────────────────────
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) triggerAnswer(question.trim());
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body, #root {
          min-height: 100vh;
          font-family: 'Syne', sans-serif;
          background: #090c14;
        }

        .wave-bar {
          width: 3px;
          border-radius: 2px;
          background: #f59e0b;
          animation: wave 0.8s ease-in-out infinite alternate;
          height: 8px;
        }
        @keyframes wave {
          0%  { height: 4px;  opacity: 0.4; }
          100% { height: 28px; opacity: 1; }
        }

        .scanline {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          );
          pointer-events: none;
          border-radius: inherit;
        }

        .glow-green { box-shadow: 0 0 20px rgba(74,222,128,0.15), 0 0 60px rgba(74,222,128,0.05); }
        .glow-amber { box-shadow: 0 0 20px rgba(245,158,11,0.25), 0 0 60px rgba(245,158,11,0.1); }
        .glow-blue  { box-shadow: 0 0 20px rgba(96,165,250,0.2),  0 0 60px rgba(96,165,250,0.08); }

        .mic-ring {
          position: absolute; inset: -6px;
          border-radius: 50%;
          border: 2px solid rgba(245,158,11,0.5);
          animation: ping 1s cubic-bezier(0,0,0.2,1) infinite;
        }
        @keyframes ping {
          75%,100% { transform: scale(1.4); opacity: 0; }
        }

        .answer-text {
          font-family: 'Space Mono', monospace;
          line-height: 1.85;
          white-space: pre-wrap;
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }

        .card {
          background: #0d1117;
          border: 1px solid #1e293b;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }

        .upload-zone {
          border: 1.5px dashed #1e293b;
          border-radius: 12px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .upload-zone:hover {
          border-color: #4ade80;
          background: rgba(74,222,128,0.04);
        }

        .mic-btn {
          width: 72px; height: 72px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          position: relative;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s;
        }
        .mic-btn:hover { transform: scale(1.05); }
        .mic-btn:active { transform: scale(0.97); }

        .history-item {
          border-left: 2px solid #1e293b;
          padding-left: 12px;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .history-item:hover { border-left-color: #4ade80; }

        input[type="text"] {
          background: #0d1117;
          border: 1px solid #1e293b;
          border-radius: 10px;
          color: #e2e8f0;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          padding: 10px 14px;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        input[type="text"]:focus { border-color: #4ade80; }
      `}</style>

      <div className="grid-bg min-h-screen text-slate-200 p-4 md:p-8">
        {/* Header */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4ade80, #22d3ee)" }}>
                  <span className="text-black font-bold text-sm">AI</span>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#f1f5f9" }}>
                  Interview<span style={{ color: "#4ade80" }}>Assistant</span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-mono pl-11">voice → ai → answer · real-time</p>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Left column */}
            <div className="md:col-span-1 flex flex-col gap-4">

              {/* Resume upload */}
              <div className="card p-4">
                <div className="scanline" />
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Resume</p>
                <label className="upload-zone block p-4 text-center">
                  <input type="file" accept=".txt" className="hidden" onChange={handleResume} />
                  {resumeName ? (
                    <div>
                      <div className="text-2xl mb-1">📄</div>
                      <p className="text-xs text-green-400 font-mono truncate">{resumeName}</p>
                      <p className="text-xs text-slate-500 mt-1">{resume.length} chars loaded</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl mb-2">⬆️</div>
                      <p className="text-sm text-slate-400">Upload <span className="text-green-400">.txt</span> resume</p>
                      <p className="text-xs text-slate-600 mt-1">for personalized answers</p>
                    </div>
                  )}
                </label>
                {resumeName && (
                  <button
                    onClick={() => { setResume(""); setResumeName(""); }}
                    className="mt-2 text-xs text-slate-600 hover:text-red-400 transition-colors w-full text-center font-mono"
                  >
                    ✕ Remove resume
                  </button>
                )}
              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="card p-4 flex-1">
                  <div className="scanline" />
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">History</p>
                  <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                    {history.map((h) => (
                      <div
                        key={h.ts}
                        className="history-item"
                        onClick={() => { setQuestion(h.question); setAnswer(h.answer); setStatus("done"); }}
                      >
                        <p className="text-xs text-slate-400 line-clamp-1">{h.question}</p>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{h.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="md:col-span-2 flex flex-col gap-4">

              {/* Mic + waveform */}
              <div className={`card p-6 flex flex-col items-center gap-4 ${isListening ? "glow-amber" : status === "done" ? "glow-green" : ""}`}>
                <div className="scanline" />

                {/* Mic button */}
                <div className="relative">
                  {isListening && <div className="mic-ring" />}
                  <button
                    className="mic-btn"
                    onClick={toggleMic}
                    style={{
                      background: isListening
                        ? "linear-gradient(135deg, #f59e0b, #ef4444)"
                        : "linear-gradient(135deg, #4ade80, #22d3ee)",
                    }}
                  >
                    <span className="text-black text-2xl">{isListening ? "⏹" : "🎙"}</span>
                  </button>
                </div>

                <Waveform active={isListening} />

                <p className="text-xs text-slate-500 font-mono text-center">
                  {isListening
                    ? "Speak your question... pauses auto-trigger"
                    : "Click mic to start listening"}
                </p>

                {/* Live transcript */}
                {(transcript || question) && (
                  <div className="w-full p-3 rounded-xl text-sm text-amber-300 font-mono" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <span className="text-amber-600 text-xs">Q: </span>
                    {transcript || question}
                  </div>
                )}
              </div>

              {/* Manual input */}
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Or type a question manually..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!question.trim() || status === "thinking"}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-black transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #4ade80, #22d3ee)", whiteSpace: "nowrap" }}
                >
                  Ask →
                </button>
              </form>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl text-sm text-red-400 font-mono" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  ⚠ {error}
                </div>
              )}

              {/* Thinking loader */}
              {status === "thinking" && (
                <div className={`card p-6 glow-blue`}>
                  <div className="scanline" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">Generating answer...</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                    <div className="h-full rounded-full animate-pulse" style={{ background: "linear-gradient(90deg, #60a5fa, #a78bfa)", width: "60%" }} />
                  </div>
                </div>
              )}

              {/* Answer */}
              {answer && status !== "thinking" && (
                <div ref={answerBoxRef} className={`card p-6 glow-green`}>
                  <div className="scanline" />
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Answer</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(answer)}
                      className="text-xs font-mono text-slate-500 hover:text-green-400 transition-colors"
                    >
                      copy ⧉
                    </button>
                  </div>
                  <p className="answer-text text-slate-200 text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>
                    {answer}
                  </p>
                </div>
              )}

              {/* Empty state */}
              {!answer && status === "idle" && !error && (
                <div className="card p-8 flex flex-col items-center justify-center text-center opacity-40">
                  <div className="scanline" />
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-sm text-slate-400 font-mono">Start mic or type a question</p>
                  <p className="text-xs text-slate-600 mt-1">AI answers appear here instantly</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-700 font-mono mt-8">
            powered by claude · web speech api · no backend required
          </p>
        </div>
      </div>
    </>
  );
}
