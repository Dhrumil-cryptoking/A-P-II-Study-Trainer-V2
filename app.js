const UNIT_FILES = [
  ["Endocrine", "data/endocrine.jsonl"],
  ["Blood", "data/blood.jsonl"],
  ["Heart", "data/heart.jsonl"],
  ["Blood Vessels", "data/vessels.jsonl"],
  ["Lymphatic & Immune", "data/immune.jsonl"],
  ["Urinary", "data/urinary.jsonl"],
  ["Digestive", "data/digestive.jsonl"],
  ["Reproductive", "data/reproductive.jsonl"],
  ["Nervous", "data/nervous.jsonl"],
];

const CHAIN_FILE = "data/chains.jsonl";
const el = (id) => document.getElementById(id);

const state = {
  bankByUnit: new Map(), // unit -> questions[]
  sessionPool: [],
  idx: 0,
  mode: "mixed",
};

function basePathSafe(url) {
  // Works on GitHub Pages even in subfolders
  return new URL(url, window.location.href).toString();
}

async function fetchText(path) {
  const res = await fetch(basePathSafe(path));
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.text();
}

function parseJSONL(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function buildUnitCheckboxes() {
  const wrap = el("unitList");
  wrap.innerHTML = "";
  UNIT_FILES.forEach(([unit]) => {
    const label = document.createElement("label");
    label.className = "pill";
    label.innerHTML = `<input type="checkbox" data-unit="${unit}" checked /> ${unit}`;
    wrap.appendChild(label);
  });

  el("selectAllBtn").onclick = () => {
    wrap.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = true));
  };
  el("selectNoneBtn").onclick = () => {
    wrap.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = false));
  };
}

function getSelectedUnits() {
  return [...el("unitList").querySelectorAll("input[type=checkbox]")]
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.unit);
}

async function loadUnitFile(unit, path) {
  const text = await fetchText(path);
  const qs = parseJSONL(text).map((q) => ({ ...q, unit }));
  state.bankByUnit.set(unit, qs);
}

async function loadAllSelectedUnits() {
  const units = getSelectedUnits();
  if (units.length === 0) throw new Error("Select at least 1 unit.");

  const selectedPairs = UNIT_FILES.filter(([u]) => units.includes(u));
  await Promise.all(selectedPairs.map(([u, path]) => loadUnitFile(u, path)));

  el("loadedMsg").textContent = `Loaded: ${units.join(", ")}`;
}

async function loadChains() {
  // Chains should live in the SAME bankByUnit as other Qs so unit filters work
  const text = await fetchText(CHAIN_FILE);
  const lines = parseJSONL(text);
  lines.forEach((q) => {
    // IMPORTANT: q.unit must match EXACT unit name (Endocrine, Blood, etc.)
    q.type = "chain";
    if (!q.unit) return;
    if (!state.bankByUnit.has(q.unit)) state.bankByUnit.set(q.unit, []);
    state.bankByUnit.get(q.unit).push(q);
  });
}

function pickSessionQuestions(units, mode, n) {
  let pool = [];
  units.forEach((u) => {
    const arr = state.bankByUnit.get(u) || [];
    pool = pool.concat(arr);
  });

  if (mode === "mcq") pool = pool.filter((q) => q.type === "mcq");
  if (mode === "open") pool = pool.filter((q) => q.type === "open");
  if (mode === "chain") pool = pool.filter((q) => q.type === "chain");

  // mixed = keep all types
  shuffle(pool);
  return pool.slice(0, Math.min(n, pool.length));
}

function showQuiz() {
  el("quiz").style.display = "block";
  el("feedback").style.display = "none";
  el("nextBtn").disabled = true;
}

function renderQuestion() {
  const q = state.sessionPool[state.idx];
  if (!q) return;

  el("meta").textContent = `Unit: ${q.unit} • Type: ${q.type.toUpperCase()} • ${state.idx + 1}/${state.sessionPool.length}`;
  el("stem").textContent = q.stem || "(No stem)";

  el("feedback").style.display = "none";
  el("nextBtn").disabled = true;

  // toggle blocks
  el("mcqBlock").style.display = q.type === "mcq" ? "block" : "none";
  el("openBlock").style.display = q.type === "open" ? "block" : "none";
  el("chainBlock").style.display = q.type === "chain" ? "block" : "none";

  // MCQ
  if (q.type === "mcq") {
    const choices = q.choices || [];
    el("mcqChoices").innerHTML = choices
      .map(
        (c, idx) =>
          `<label><input type="radio" name="mcq" value="${idx}"> ${String.fromCharCode(65 + idx)}. ${c}</label>`
      )
      .join("");
  }

  // Open
  if (q.type === "open") {
    el("openAnswer").value = "";
  }
}

function submitMCQ() {
  const q = state.sessionPool[state.idx];
  const chosen = document.querySelector('input[name="mcq"]:checked');
  if (!chosen) return;

  const picked = Number(chosen.value);
  const correct = picked === q.answer;

  el("feedback").style.display = "block";
  el("feedback").innerHTML = `<strong>${correct ? "✅ Correct" : "❌ Incorrect"}</strong>`;
  el("nextBtn").disabled = false;
}

function submitOpen() {
  el("feedback").style.display = "block";
  el("feedback").innerHTML = `<strong>✅ Submitted</strong><div class="muted">We can add an answer key later if you want.</div>`;
  el("nextBtn").disabled = false;
}

function submitChain() {
  el("feedback").style.display = "block";
  el("feedback").innerHTML = `<strong>✅ Submitted</strong><div class="muted">Chain UI can be added next once questions load.</div>`;
  el("nextBtn").disabled = false;
}

async function start() {
  state.mode = el("mode").value;
  const n = Number(el("numQ").value || 25);
  const units = getSelectedUnits();

  // Load selected units fresh each session
  state.bankByUnit = new Map();
  await loadAllSelectedUnits();
  await loadChains(); // optional; only matters if you use chain/mixed

  state.sessionPool = pickSessionQuestions(units, state.mode, n);
  state.idx = 0;

  if (state.sessionPool.length === 0) {
    el("loadedMsg").textContent = `No questions found for that selection.`;
    return;
  }

  showQuiz();
  renderQuestion();
}

function reset() {
  el("quiz").style.display = "none";
  el("loadedMsg").textContent = "";
  state.sessionPool = [];
  state.idx = 0;
}

function init() {
  buildUnitCheckboxes();

  el("startBtn").onclick = () => start().catch((e) => {
    console.error(e);
    el("loadedMsg").textContent = `Error: ${e.message}`;
  });

  el("resetBtn").onclick = reset;

  el("submitBtn").onclick = submitMCQ;
  el("submitOpenBtn").onclick = submitOpen;
  el("submitChainBtn").onclick = submitChain;

  el("nextBtn").onclick = () => {
    state.idx++;
    if (state.idx >= state.sessionPool.length) {
      el("feedback").style.display = "block";
      el("feedback").innerHTML = `<strong>Done ✅</strong>`;
      el("nextBtn").disabled = true;
      return;
    }
    renderQuestion();
  };
}

init();
