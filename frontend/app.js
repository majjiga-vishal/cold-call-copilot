const API_BASE = "https://cold-call-copilot-api.onrender.com";

let currentCallId = null;
let currentStageIndex = 0;

const STAGES = [
  {
    name: "Opener / Hook",
    goal: "Earn 30 seconds of attention",
    script: "Hey Alex, I know I caught you out of the blue. Do you have 30 seconds for me to tell you why I called?",
    trap: "Avoid asking 'How are you today?'—it immediately flags you as an unsolicited telemarketer.",
  },
  {
    name: "Problem Hook",
    goal: "Confirm a specific operational friction",
    script: "Most founders we talk to say their reps get overwhelmed on live calls and lose deals during objections. Does that sound familiar?",
    trap: "Don't lecture them. Keep the prompt short so they are forced to confirm or clarify their pain.",
  },
  {
    name: "Value Proposition",
    goal: "Connect the problem to one clear outcome",
    script: "We give live objection prompts directly on screen, which lifted connect-to-meeting conversions by 28% for sales teams.",
    trap: "Do not explain every technical feature. Stick strictly to the business outcome.",
  },
  {
    name: "Objection Handling",
    goal: "Neutralize pushback without debating",
    script: "Totally understand you're busy right now. I don't want to take your time today—would Tuesday at 10 AM be better for a 5-minute glance?",
    trap: "Never argue. Validate their concern first, then pivot smoothly.",
  },
  {
    name: "Closing / Next Step",
    goal: "Lock down calendar invite",
    script: "Let me send a calendar placeholder for 10 minutes next week. What's the best email address to send that to?",
    trap: "Never say 'Let me follow up with an email whenever you're free'. Get a concrete day and time.",
  }
];

function renderStages() {
  const container = document.getElementById("stages-container");
  container.innerHTML = "";

  STAGES.forEach((stage, idx) => {
    const isActive = idx === currentStageIndex;
    const isPast = idx < currentStageIndex;

    const el = document.createElement("div");
    el.className = `p-3 rounded-lg border transition ${
      isActive 
        ? "bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm"
        : isPast 
          ? "bg-slate-900/40 border-slate-800 text-slate-500 line-through" 
          : "bg-slate-900/20 border-slate-800/40 text-slate-400"
    }`;
    el.innerHTML = `
      <div class="flex items-center justify-between text-xs font-medium">
        <span>${idx + 1}. ${stage.name}</span>
        ${isActive ? '<span class="text-indigo-400 font-bold uppercase text-[10px]">Active</span>' : ''}
        ${isPast ? '<span class="text-emerald-500 text-[10px]">✓</span>' : ''}
      </div>
    `;
    container.appendChild(el);
  });

  const active = STAGES[currentStageIndex];
  document.getElementById("active-stage-title").innerText = `${currentStageIndex + 1}. ${active.name}`;
  document.getElementById("stage-exit-gate").innerText = `Goal: ${active.goal}`;
  document.getElementById("script-opener").innerText = `"${active.script}"`;
  document.getElementById("stage-trap").innerText = active.trap;
}

async function startCall() {
  const name = document.getElementById("prospect-name").value || "Alex Morgan";
  const company = document.getElementById("company-name").value || "FinScale Corp";

  try {
    const res = await fetch(`${API_BASE}/api/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_name: name, company_name: company })
    });
    const data = await res.json();
    currentCallId = data.call_id;
    currentStageIndex = 0;

    document.getElementById("call-status-badge").innerText = "Active Call";
    document.getElementById("call-status-badge").className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
    document.getElementById("btn-start-call").innerText = "Call in Progress...";
    document.getElementById("btn-start-call").disabled = true;

    addTimelineNote(`Started call with ${name} (${company})`);
    renderStages();
  } catch (err) {
    alert("Could not connect to backend server. Make sure it is running on port 5000.");
  }
}

async function advanceStage() {
  if (!currentCallId) {
    alert("Please click 'Start Active Call' first!");
    return;
  }

  const currentStage = STAGES[currentStageIndex];
  const prospectReaction = document.getElementById("prospect-reaction-input").value;

  try {
    await fetch(`${API_BASE}/api/calls/${currentCallId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage_name: currentStage.name,
        prospect_reaction: prospectReaction,
        caller_notes: `Completed stage ${currentStage.name}`
      })
    });

    addTimelineNote(`Completed: ${currentStage.name} ${prospectReaction ? `— "${prospectReaction}"` : ''}`);
    document.getElementById("prospect-reaction-input").value = "";
    document.getElementById("ai-response-box").classList.add("hidden");

    if (currentStageIndex < STAGES.length - 1) {
      currentStageIndex++;
      renderStages();
    } else {
      endCurrentCall();
    }
  } catch (err) {
    console.error(err);
  }
}

async function requestAiCoach() {
  const prospectWords = document.getElementById("prospect-reaction-input").value;
  if (!prospectWords.trim()) {
    alert("Please enter what the prospect said first!");
    return;
  }

  const aiBox = document.getElementById("ai-response-box");
  aiBox.classList.remove("hidden");
  aiBox.innerText = "Coaching you live with Gemini...";

  try {
    const res = await fetch(`${API_BASE}/api/ai-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_stage: STAGES[currentStageIndex].name,
        prospect_words: prospectWords
      })
    });
    const data = await res.json();
    aiBox.innerText = data.advice;
  } catch (err) {
    aiBox.innerText = "Could not fetch AI advice. Check backend console.";
  }
}

async function endCurrentCall() {
  if (!currentCallId) return;

  const outcome = prompt("Select call outcome:\n1. Meeting Booked\n2. Follow-Up Requested\n3. Not Interested", "Meeting Booked");

  try {
    await fetch(`${API_BASE}/api/calls/${currentCallId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: outcome || "Completed", notes: "Call wrapped up." })
    });

    addTimelineNote(`Call Ended — Outcome: ${outcome || 'Completed'}`);
    document.getElementById("call-status-badge").innerText = "Call Completed";
    document.getElementById("call-status-badge").className = "text-xs font-semibold px-3 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30";
    document.getElementById("btn-start-call").disabled = false;
    document.getElementById("btn-start-call").innerText = "📞 Start New Call";
    currentCallId = null;
  } catch (err) {
    console.error(err);
  }
}

function addTimelineNote(text) {
  const timeline = document.getElementById("notes-timeline");
  if (timeline.children.length === 1 && timeline.innerText.includes("No logs yet")) {
    timeline.innerHTML = "";
  }
  const note = document.createElement("div");
  note.className = "p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300";
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  note.innerHTML = `<span class="text-slate-500 font-mono text-[10px] block">${time}</span>${text}`;
  timeline.prepend(note);
}

function saveQuickNote() {
  const box = document.getElementById("quick-note");
  if (!box.value.trim()) return;
  addTimelineNote(`Note: ${box.value}`);
  box.value = "";
}

// Initial render
renderStages();