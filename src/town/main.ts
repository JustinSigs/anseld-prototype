// ============================================================
// The Clockwork Town — boot, loop, input, HUD.
// Slice 1: walk, watch, possess, talk, overhear. No prophecies,
// no scars — first prove the town is worth standing in.
// ============================================================

import '../style.css';
import './town.css';
import { TownSim, type AgentState } from './sim';
import { TownRenderer, CELL } from './render';
import { MockDialogue, LiveDialogue, type DialogueProvider } from './dialogue';
import { ClaudeClient } from '../ai/client';

let sim: TownSim;
let renderer: TownRenderer;
let dialogue: DialogueProvider;
let client: ClaudeClient | null = null;
let busy = false;

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

function boot() {
  document.body.innerHTML = LAYOUT;
  ($('#tt-key') as HTMLInputElement).value = localStorage.getItem('anseld.apiKey') ?? '';
  $('#tt-start-mock').onclick = () => start('mock');
  $('#tt-start-live').onclick = () => start('live');
}

function start(mode: 'mock' | 'live') {
  if (mode === 'live') {
    const key = ($('#tt-key') as HTMLInputElement).value.trim();
    if (!key) {
      $('#tt-start-error').textContent = 'Live voices need an API key — or start the free mock town.';
      return;
    }
    localStorage.setItem('anseld.apiKey', key);
    client = new ClaudeClient(key);
    dialogue = new LiveDialogue(client, () => 'claude-haiku-4-5-20251001');
  } else {
    dialogue = new MockDialogue();
  }

  sim = new TownSim('merra');
  $('#tt-start').style.display = 'none';
  $('#tt-game').style.display = 'block';
  renderer = new TownRenderer($('#tt-canvas') as HTMLCanvasElement);
  $('#tt-dialog-close').onclick = closePanels;
  bindInput();
  toast('You wake as Merra Quill, mid-morning-count. Watch the town. WASD to walk, E beside someone to act, Space to pause, 1/2/3 for speed.');
  requestAnimationFrame(loop);
}

// ---------------- The loop ----------------

let lastTs = 0;
function loop(ts: number) {
  const dt = lastTs === 0 ? 16 : Math.min(100, ts - lastTs);
  lastTs = ts;
  sim.tick(dt);
  renderer.render(sim);
  renderOverlays();
  renderHud();
  requestAnimationFrame(loop);
}

// ---------------- Input ----------------

const held = new Set<string>();
let moveCooldown = 0;

function bindInput() {
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    held.add(e.key.toLowerCase());
    if (e.key === ' ') {
      e.preventDefault();
      sim.clock.speed = sim.clock.speed === 0 ? 1 : 0;
    }
    if (e.key === '1') sim.clock.speed = 1;
    if (e.key === '2') sim.clock.speed = 2;
    if (e.key === '3') sim.clock.speed = 4;
    if (e.key.toLowerCase() === 'e') interact();
    if (e.key === 'Escape') closePanels();
  });
  document.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

  setInterval(() => {
    if (busy || panelOpen()) return;
    if (moveCooldown > 0) {
      moveCooldown -= 40;
      return;
    }
    const dx = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const dy = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const moved = sim.tryMovePlayer(dx !== 0 ? dx : 0, dx !== 0 ? 0 : dy);
      if (moved) moveCooldown = 130;
    }
  }, 40);
}

// ---------------- Actions ----------------

function interact() {
  if (busy || panelOpen()) return;
  const nearby = sim.adjacentAgents();
  if (nearby.length === 0) {
    // Maybe an overhearable murmur instead.
    const pairs = sim.overhearablePairs();
    if (pairs.length > 0) {
      void doOverhear(pairs[0][0], pairs[0][1]);
      return;
    }
    toast('No one in reach. Stand beside someone.');
    return;
  }
  openActionMenu(nearby);
}

/** Panels hold the world: speed drops to 0 while a menu or dialogue is open. */
let resumeSpeed: 0 | 1 | 2 | 4 = 1;
function holdWorld() {
  if (sim.clock.speed !== 0) resumeSpeed = sim.clock.speed;
  sim.clock.speed = 0;
}
function releaseWorld() {
  if (!panelOpen()) sim.clock.speed = resumeSpeed;
}

function openActionMenu(nearby: AgentState[]) {
  holdWorld();
  const el = $('#tt-menu');
  el.innerHTML = '';
  for (const agent of nearby) {
    const row = document.createElement('div');
    row.className = 'tt-menu-row';
    row.innerHTML = `<span>${agent.def.name} <span class="dim">— ${agent.activity}</span></span>`;
    const talk = document.createElement('button');
    talk.textContent = 'Talk';
    talk.onclick = () => {
      el.style.display = 'none';
      void doTalk(agent);
    };
    const poss = document.createElement('button');
    poss.textContent = 'Possess';
    poss.onclick = () => {
      el.style.display = 'none';
      const res = sim.possess(agent.def.id);
      if (!res.ok) toast(res.reason ?? 'The door does not open.');
      else toast(`You are ${agent.def.name} now. The body you left resumes its day, unsteered.`);
      releaseWorld();
    };
    if (sim.player().def.species !== 'human') talk.disabled = true;
    row.appendChild(talk);
    row.appendChild(poss);
    el.appendChild(row);
  }
  const close = document.createElement('button');
  close.textContent = 'Never mind';
  close.onclick = () => {
    el.style.display = 'none';
    releaseWorld();
  };
  el.appendChild(close);
  el.style.display = 'block';
}

async function doTalk(target: AgentState) {
  busy = true;
  holdWorld();
  $('#tt-dialog').style.display = 'block';
  $('#tt-dialog-body').textContent = '…';
  $('#tt-dialog-name').textContent = target.def.name;
  try {
    const text = await dialogue.talk(sim, target);
    $('#tt-dialog-body').textContent = text;
  } catch (err) {
    $('#tt-dialog-body').textContent = `The words failed: ${String(err).slice(0, 200)}`;
  } finally {
    busy = false;
  }
}

async function doOverhear(a: AgentState, b: AgentState) {
  busy = true;
  sim.markOverheard(a, b);
  try {
    const text = await dialogue.overhear(sim, a, b);
    toast(text, 9000);
  } catch (err) {
    toast(`The murmur is lost: ${String(err).slice(0, 120)}`);
  } finally {
    busy = false;
  }
}

// ---------------- HUD ----------------

function renderHud() {
  const p = sim.player();
  $('#tt-clock').textContent = sim.clock.label;
  $('#tt-host').textContent = `${p.def.name} — ${p.def.role} (${p.def.species})`;
  $('#tt-cost').textContent = client ? `$${client.totalCostUsd().toFixed(3)}` : 'mock — $0';
  document.querySelectorAll('.tt-speed').forEach((b) => {
    const speed = Number((b as HTMLElement).dataset.speed);
    b.classList.toggle('active', sim.clock.speed === speed);
  });
}

function renderOverlays() {
  const el = $('#tt-labels');
  el.innerHTML = '';
  const p = sim.player();
  for (const agent of sim.agents) {
    if (agent.worn) continue;
    const dist = Math.abs(agent.x - p.x) + Math.abs(agent.y - p.y);
    if (dist > 5) continue;
    const pos = renderer.screenPos(agent.x, agent.y);
    if (!pos.visible) continue;
    const label = document.createElement('div');
    label.className = 'tt-label';
    label.style.left = `${pos.sx + CELL / 2}px`;
    label.style.top = `${pos.sy - 6}px`;
    label.textContent = `${agent.def.name} · ${agent.activity}`;
    el.appendChild(label);
  }
  // Murmur markers.
  for (const [a, b] of sim.overhearablePairs()) {
    const pos = renderer.screenPos((a.x + b.x) / 2, Math.min(a.y, b.y));
    if (!pos.visible) continue;
    const m = document.createElement('div');
    m.className = 'tt-murmur';
    m.style.left = `${pos.sx + CELL / 2}px`;
    m.style.top = `${pos.sy - 26}px`;
    m.textContent = '❝…❞ E to listen';
    el.appendChild(m);
  }
}

let toastTimer: number | undefined;
function toast(text: string, ms = 6000) {
  const el = $('#tt-toast');
  el.textContent = text;
  el.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.style.display = 'none'), ms);
}

function panelOpen(): boolean {
  return $('#tt-dialog').style.display === 'block' || $('#tt-menu').style.display === 'block';
}

function closePanels() {
  $('#tt-dialog').style.display = 'none';
  $('#tt-menu').style.display = 'none';
  releaseWorld();
}

// ---------------- Layout ----------------

const LAYOUT = `
<div id="tt-start">
  <h1>ANSELD</h1>
  <div class="subtitle">prototype 2 — the clockwork town</div>
  <div class="start-box">
    <button id="tt-start-mock">Enter Saltmere — mock voices, free</button>
    <button id="tt-start-live">Enter Saltmere — live voices (AI)</button>
    <label>API key (live voices only)</label>
    <input id="tt-key" type="password" placeholder="sk-ant-…">
    <div id="tt-start-error" class="error"></div>
    <div class="dim" style="margin-top:16px">Walk: WASD/arrows · Act: E · Pause: Space · Speed: 1/2/3<br>
    The town runs on its own clock. Watch it. Anyone you can stand beside, you can be.<br>
    <a href="index.html">← the original text prototype</a> · <a href="island.html">Gullshead Island →</a></div>
  </div>
</div>

<div id="tt-game" style="display:none">
  <header>
    <span id="tt-clock" class="chip"></span>
    <button class="tt-speed" data-speed="0" onclick="void 0">⏸</button>
    <button class="tt-speed" data-speed="1">1x</button>
    <button class="tt-speed" data-speed="2">2x</button>
    <button class="tt-speed" data-speed="4">4x</button>
    <span id="tt-host" class="chip"></span>
    <span id="tt-cost" class="chip"></span>
  </header>
  <div id="tt-stage">
    <canvas id="tt-canvas"></canvas>
    <div id="tt-labels"></div>
    <div id="tt-menu" style="display:none"></div>
    <div id="tt-dialog" style="display:none">
      <div id="tt-dialog-name" class="panel-head"></div>
      <div id="tt-dialog-body"></div>
      <button id="tt-dialog-close">Leave them to it</button>
    </div>
    <div id="tt-toast" style="display:none"></div>
  </div>
</div>
`;

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.classList?.contains('tt-speed')) {
    sim.clock.speed = Number(t.dataset.speed) as 0 | 1 | 2 | 4;
  }
});

boot();
