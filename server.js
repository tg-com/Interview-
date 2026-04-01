require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Interview Assistant</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body{font-family:sans-serif;background:#090c14;color:#e2e8f0;min-height:100vh}
    .card{background:#0d1117;border:1px solid #1e293b;border-radius:16px}
    .wave-bar{width:3px;border-radius:2px;background:#f59e0b;animation:wave 0.8s ease-in-out infinite alternate;height:8px;display:inline-block}
    @keyframes wave{0%{height:4px;opacity:.4}100%{height:28px;opacity:1}}
    .mic-btn{width:72px;height:72px;border-radius:50%;border:none;cursor:pointer;font-size:1.5rem;transition:transform .15s}
    #manual-q{background:#0d1117;border:1px solid #1e293b;border-radius:10px;color:#e2e8f0;font-size:14px;padding:10px 14px;outline:none;width:100%}
    #manual-q:focus{border-color:#4ade80}
    .answer-text{font-family:monospace;line-height:1.85}
  </style>
</head>
<body class="p-4">
<div class="max-w-2xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#4ade80,#22d3ee)"><span class="text-black font-bold text-sm">AI</span></div>
      <h1 class="text-2xl font-bold">Interview<span style="color:#4ade80">Assistant</span></h1>
    </div>
    <div id="sb" class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono" style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);color:#4ade80">◉ <span id="st">Ready</span></div>
  </div>

  <div class="card p-4 mb-4">
    <p class="text-xs text-slate-500 mb-2">Resume (optional .txt)</p>
    <label style="border:1.5px dashed #1e293b;border-radius:12px;padding:16px;text-align:center;cursor:pointer;display:block">
      <input type="file" accept=".txt" class="hidden" id="ri" />
      <div id="ui"><div class="text-xl mb-1">⬆️</div><p class="text-sm text-slate-400">Upload .txt resume</p></div>
    </label>
  </div>

  <div class="card p-6 flex flex-col items-center gap-4 mb-4">
    <button class="mic-btn" id="mb" style="background:linear-gradient(135deg,#4ade80,#22d3ee)">🎙</button>
    <div class="flex items-center gap-[3px] h-8" id="wf"></div>
    <p class="text-xs text-slate-500 font-mono" id="mh">Click mic to start listening</p>
    <div class="w-full p-3 rounded-xl text-sm font-mono hidden" id="tb" style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.15);color:#fcd34d">Q: <span id="tt"></span></div>
  </div>

  <div class="flex gap-2 mb-4">
    <input type="text" id="manual-q" placeholder="Or type a question..." />
    <button onclick="handleManual()" class="px-5 py-2 rounded-xl text-sm font-bold text-black" style="background:linear-gradient(135deg,#4ade80,#22d3ee);white-space:nowrap">Ask →</button>
  </div>

  <div class="p-3 rounded-xl text-sm font-mono hidden mb-4" id="eb" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);color:#f87171"></div>

  <div class="card p-5 hidden mb-4" id="thb">
    <div class="flex items-center gap-3">
      <div class="flex gap-1.5">
        <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></div>
        <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay:.15s"></div>
        <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay:.3s"></div>
      </div>
      <span class="text-xs font-mono text-blue-400">Generating answer...</span>
    </div>
  </div>

  <div class="card p-5 hidden mb-4" id="ab">
    <div class="flex justify-between items-center mb-3">
      <p class="text-xs text-slate-500 uppercase tracking-widest">Answer</p>
      <button onclick="copyAnswer()" class="text-xs text-slate-500 hover:text-green-400">copy ⧉</button>
    </div>
    <p class="answer-text text-sm" id="at" style="color:#e2e8f0"></p>
  </div>
</div>

<script>
let resume="",isListening=false,recognition=null,currentQ="";
const wf=document.getElementById("wf");
for(let i=0;i<16;i++){const b=document.createElement("div");b.className="wave-bar";b.style.cssText="animation-delay:"+(i*.07)+"s;animation-play-state:paused;opacity:.3";wf.appendChild(b);}
const setWave=on=>wf.querySelectorAll(".wave-bar").forEach(b=>{b.style.animationPlayState=on?"running":"paused";b.style.opacity=on?"1":".3";});
const setStatus=(t,c)=>{document.getElementById("st").textContent=t;document.getElementById("sb").style.color=c||"#4ade80";};

document.getElementById("ri").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{resume=ev.target.result;document.getElementById("ui").innerHTML="<p class='text-xs' style='color:#4ade80'>✅ "+f.name+"</p>";};
  r.readAsText(f);
});

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  recognition=new SR();recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=e=>{
    let fi="",ii="";
    for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)fi+=e.results[i][0].transcript;else ii+=e.results[i][0].transcript;}
    showQ(fi||ii);
    if(fi){currentQ=fi;setTimeout(()=>recognition.stop(),1200);}
  };
  recognition.onend=()=>{stopMic();if(currentQ)getAnswer(currentQ);};
  recognition.onerror=e=>{stopMic();showError("Mic: "+e.error);};
}

document.getElementById("mb").addEventListener("click",()=>{
  if(!recognition){showError("Use Chrome for voice.");return;}
  if(isListening){recognition.stop();return;}
  currentQ="";hideAll();setStatus("Listening...","#f59e0b");
  isListening=true;setWave(true);
  document.getElementById("mb").textContent="⏹";
  document.getElementById("mb").style.background="linear-gradient(135deg,#f59e0b,#ef4444)";
  document.getElementById("mh").textContent="Speak now...";
  recognition.start();
});

function stopMic(){
  isListening=false;setWave(false);
  document.getElementById("mb").textContent="🎙";
  document.getElementById("mb").style.background="linear-gradient(135deg,#4ade80,#22d3ee)";
  document.getElementById("mh").textContent="Click mic to start listening";
}

function handleManual(){const q=document.getElementById("manual-q").value.trim();if(q)getAnswer(q);}
document.getElementById("manual-q").addEventListener("keydown",e=>{if(e.key==="Enter")handleManual();});

async function getAnswer(question){
  hideAll();setStatus("Thinking...","#60a5fa");
  document.getElementById("thb").classList.remove("hidden");
  showQ(question);
  try{
    const res=await fetch("/get-answer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,resume})});
    const text=await res.text();
    let data;
    try{data=JSON.parse(text);}catch{throw new Error("Server error: "+text.substring(0,150));}
    if(!res.ok)throw new Error(data.error||"Error "+res.status);
    document.getElementById("thb").classList.add("hidden");
    document.getElementById("at").textContent=data.answer;
    document.getElementById("ab").classList.remove("hidden");
    setStatus("Done ✓","#4ade80");
  }catch(err){
    document.getElementById("thb").classList.add("hidden");
    showError(err.message);setStatus("Error","#f87171");
  }
}

function showQ(t){document.getElementById("tt").textContent=t;document.getElementById("tb").classList.remove("hidden");}
function hideAll(){["ab","eb","thb"].forEach(id=>document.getElementById(id).classList.add("hidden"));}
function showError(m){document.getElementById("eb").textContent="⚠ "+m;document.getElementById("eb").classList.remove("hidden");}
function copyAnswer(){navigator.clipboard.writeText(document.getElementById("at").textContent);}
<\/script>
</body></html>`;

app.get('/', (req, res) => res.send(HTML));
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/get-answer', async (req, res) => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing in Railway Variables!' });

  const { question, resume } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question required' });

  const prompt = `You are a professional interview assistant. Answer confidently in 3-5 sentences. No bullet points.
${resume ? 'Resume:\n' + resume + '\n' : ''}Question: ${question}\nAnswer:`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d?.error?.message || 'Claude API error' });
    const answer = d?.content?.[0]?.text;
    if (!answer) return res.status(502).json({ error: 'Empty response from Claude' });
    console.log('[Q]:', question);
    res.json({ answer });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log('✅ Running on port', PORT));
  
