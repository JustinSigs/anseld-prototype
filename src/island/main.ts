// ============================================================
// Gullshead Island — boot, loop, input, and the mayor's desk.
// ============================================================

import '../style.css';
import './island.css';
import { IslandSim, SEASON_DAYS, type LocalState, type TouristState } from './sim';
import { IslandRenderer, CELL } from './render';
import { MockIslandDialogue, LiveIslandDialogue, type IslandDialogue } from './dialogue';
import { LOTS } from './world';
import { WANT_LABEL } from './economy';
import { ClaudeClient } from '../ai/client';

let sim: IslandSim;
let renderer: IslandRenderer;
let dialogue: IslandDialogue;
let client: ClaudeClient | null = null;
let busy = false;
let talkTarget: LocalState | TouristState | null = null;
let reportShown = false;

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

function boot() {
  document.body.innerHTML = LAYOUT;
  ($('#is-key') as HTMLInputElement).value = localStorage.getItem('anseld.apiKey') ?? '';
  $('#is-start-mock').onclick = () => start('mock');
  $('#is-start-live').onclick = () => start('live');
}

function start(mode: 'mock' | 'live') {
  if (mode === 'live') {
    const key = ($('#is-key') as HTMLInputElement).value.trim();
    if (!key) {
      $('#is-start-error').textContent = 'Live voices need an API key — the free version plays fine without.';
      return;
    }
    localStorage.setItem('anseld.apiKey', key);
    client = new ClaudeClient(key);
    dialogue = new LiveIslandDialogue(client, () => 'claude-haiku-4-5-20251001');
  } else {
    dialogue = new MockIslandDialogue();
  }
  sim = new IslandSim();
  $('#is-start').style.display = 'none';
  $('#is-game').style.display = 'block';
  renderer = new IslandRenderer($('#is-canvas') as HTMLCanvasElement);
  bindInput();
  $('#is-talk-close').onclick = closeAll;
  $('#is-journal-btn').onclick = () => togglePanel('journal');
  $('#is-gazette-btn').onclick = () => togglePanel('gazette');
  sim.say('Day 1 on Gullshead. You are the mayor. The ferry comes at nine; the treasury holds 50 coin; the island holds its breath. The notice board in the square is where decisions become official.');
  requestAnimationFrame(loop);
}

let lastTs = 0;
function loop(ts: number) {
  const dt = lastTs === 0 ? 16 : Math.min(100, ts - lastTs);
  lastTs = ts;
  sim.tick(dt);
  renderer.render(sim);
  drainNotes();
  renderHud();
  renderLabels();
  maybeReport();
  requestAnimationFrame(loop);
}

// ---------------- Input ----------------

const held = new Set<string>();
let moveCooldown = 0;

function bindInput() {
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    held.add(e.key.toLowerCase());
    if (e.key === ' ') {
      e.preventDefault();
      sim.clock.speed = sim.clock.speed === 0 ? 1 : 0;
    }
    if (e.key === '1') sim.clock.speed = 1;
    if (e.key === '2') sim.clock.speed = 2;
    if (e.key === '3') sim.clock.speed = 4;
    if (e.key.toLowerCase() === 'e') interact();
    if (e.key === 'Escape') closeAll();
  });
  document.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

  setInterval(() => {
    if (busy || anyPanelOpen()) return;
    if (moveCooldown > 0) {
      moveCooldown -= 40;
      return;
    }
    const dx = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const dy = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      if (sim.tryMoveMayor(dx !== 0 ? dx : 0, dx !== 0 ? 0 : dy)) moveCooldown = 120;
    }
  }, 40);
}

// ---------------- Interaction ----------------

let resumeSpeed: 0 | 1 | 2 | 4 = 1;
function holdWorld() {
  if (sim.clock.speed !== 0) resumeSpeed = sim.clock.speed;
  sim.clock.speed = 0;
}
function releaseWorld() {
  if (!anyPanelOpen()) sim.clock.speed = resumeSpeed;
}
function anyPanelOpen(): boolean {
  return ['is-menu', 'is-talk', 'is-board', 'is-journal', 'is-gazette'].some((id) => $(`#${id}`).style.display === 'block');
}
function closeAll() {
  for (const id of ['is-menu', 'is-talk', 'is-board', 'is-journal', 'is-gazette']) $(`#${id}`).style.display = 'none';
  talkTarget = null;
  releaseWorld();
}

function interact() {
  if (busy || anyPanelOpen() || sim.seasonOver) return;
  const menu = $('#is-menu');
  menu.innerHTML = '';
  let anything = false;

  if (sim.nearPlace('notice-board', 1)) {
    anything = true;
    menu.appendChild(menuRow('The notice board', 'Open', () => {
      closeMenuOnly();
      openBoard();
    }));
  }
  if (sim.nearPlace('chapel-bell', 2)) {
    anything = true;
    menu.appendChild(menuRow('The old chapel bell', 'Ring it', () => {
      closeAll();
      sim.ringBell();
    }));
  }
  for (const person of sim.nearbyPeople()) {
    anything = true;
    const label = 'phase' in person ? `${person.def.name} (visitor)` : `${person.def.name} — ${(person as LocalState).activity}`;
    menu.appendChild(menuRow(label, 'Talk', () => {
      closeMenuOnly();
      void openTalk(person);
    }));
  }

  if (!anything) {
    sim.say('Nothing within reach. The notice board is in the square; people are where people are.');
    return;
  }
  holdWorld();
  const never = document.createElement('button');
  never.textContent = 'Never mind';
  never.onclick = closeAll;
  menu.appendChild(never);
  menu.style.display = 'block';
}

function closeMenuOnly() {
  $('#is-menu').style.display = 'none';
}

function menuRow(label: string, action: string, fn: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'is-menu-row';
  const span = document.createElement('span');
  span.textContent = label;
  const btn = document.createElement('button');
  btn.textContent = action;
  btn.onclick = fn;
  row.appendChild(span);
  row.appendChild(btn);
  return row;
}

// ---------------- Talking ----------------

async function openTalk(target: LocalState | TouristState) {
  talkTarget = target;
  holdWorld();
  $('#is-talk').style.display = 'block';
  $('#is-talk-name').textContent = target.def.name;
  $('#is-talk-body').textContent = '…';
  ($('#is-talk-input') as HTMLInputElement).value = '';
  busy = true;
  try {
    $('#is-talk-body').textContent = await dialogue.talk(sim, target);
  } catch (err) {
    $('#is-talk-body').textContent = `(${String(err).slice(0, 160)})`;
  } finally {
    busy = false;
  }
}

async function sendTalkLine() {
  if (!talkTarget || busy) return;
  const input = $('#is-talk-input') as HTMLInputElement;
  const line = input.value.trim();
  if (!line) return;
  input.value = '';
  busy = true;
  $('#is-talk-body').textContent = '…';
  try {
    $('#is-talk-body').textContent = await dialogue.talk(sim, talkTarget, line);
  } catch (err) {
    $('#is-talk-body').textContent = `(${String(err).slice(0, 160)})`;
  } finally {
    busy = false;
  }
}

document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'is-talk-send') void sendTalkLine();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).id === 'is-talk-input') void sendTalkLine();
});

// ---------------- The notice board ----------------

function openBoard() {
  holdWorld();
  const el = $('#is-board');
  let html = `<div class="panel-head">GULLSHEAD NOTICE BOARD — official until the weather says otherwise</div>
    <div class="dim">Treasury: ${sim.treasury} coin</div>`;

  html += `<div class="panel-head">Works</div>`;
  for (const lot of LOTS) {
    const state = sim.lotStates.get(lot.id)!;
    const label = state === 'open' ? 'OPEN' : state === 'building' ? 'Hobb is on it' : `${lot.cost} coin`;
    html += `<div class="is-board-row"><b>${lot.name}</b> <span class="dim">(${WANT_LABEL[lot.want]})</span><br><span class="dim">${lot.blurb}</span><br>`;
    html += state === 'ruined' ? `<button data-repair="${lot.id}">Repair — ${label}</button></div>` : `<span class="is-state">${label}</span></div>`;
  }

  html += `<div class="panel-head">Tonight</div>
    <div class="is-board-row">Bonfire (10 coin) — tourists flock to it after dark, and look at nothing else.<br>
    <button data-bonfire="beach">At the beach</button> <button data-bonfire="square">In the square</button>
    ${sim.bonfireTonight ? `<span class="is-state">posted: ${sim.bonfireTonight}</span>` : ''}</div>
    <div class="is-board-row">Salt (5 coin) — a fat white line across the north lane. Old wives swear by it. Old wives are undefeated.<br>
    <button data-salt="1">Lay the salt line</button> ${sim.saltLineLaid ? '<span class="is-state">laid</span>' : ''}</div>
    <button id="is-board-close">Close the board</button>`;

  el.innerHTML = html;
  el.style.display = 'block';
  el.querySelectorAll('[data-repair]').forEach((b) => ((b as HTMLButtonElement).onclick = () => { sim.orderRepair((b as HTMLElement).dataset.repair!); openBoard(); }));
  el.querySelectorAll('[data-bonfire]').forEach((b) => ((b as HTMLButtonElement).onclick = () => { sim.scheduleBonfire((b as HTMLElement).dataset.bonfire as 'beach' | 'square'); openBoard(); }));
  el.querySelectorAll('[data-salt]').forEach((b) => ((b as HTMLButtonElement).onclick = () => { sim.laySaltLine(); openBoard(); }));
  (el.querySelector('#is-board-close') as HTMLButtonElement).onclick = closeAll;
}

// ---------------- Panels ----------------

function togglePanel(which: 'journal' | 'gazette') {
  const id = which === 'journal' ? 'is-journal' : 'is-gazette';
  const el = $(`#${id}`);
  if (el.style.display === 'block') {
    el.style.display = 'none';
    releaseWorld();
    return;
  }
  holdWorld();
  if (which === 'journal') {
    el.innerHTML = `<div class="panel-head">THE MAYOR'S PRIVATE JOURNAL — curse pages: ${sim.journal.length}</div>` +
      (sim.journal.length === 0
        ? '<div class="dim">Empty. Whatever happens on this island at night, you have not yet stood close enough to understand it. (Being nearby when it happens writes a page. Tourists being nearby writes a refund request.)</div>'
        : sim.journal.map((p) => `<div class="is-page"><b>${p.title}</b><br>${p.text}</div>`).join('')) +
      '<button class="is-close">Close</button>';
  } else {
    el.innerHTML = `<div class="panel-head">THE MAINLAND GAZETTE — visitor letters</div>` +
      (sim.gazette.length === 0
        ? '<div class="dim">No letters yet. The mainland is watching. The mainland is always watching.</div>'
        : sim.gazette.slice(0, 12).map((g) => `<div class="is-page">${'★'.repeat(g.stars)}${'☆'.repeat(5 - g.stars)} <span class="dim">(day ${g.day})</span><br>${g.text}</div>`).join('')) +
      '<button class="is-close">Close</button>';
  }
  (el.querySelector('.is-close') as HTMLButtonElement).onclick = closeAll;
  el.style.display = 'block';
}

// ---------------- HUD ----------------

function drainNotes() {
  if (sim.notes.length === 0) return;
  const text = sim.notes.shift()!;
  const el = $('#is-toast');
  el.textContent = text;
  el.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.style.display = 'none'), 6500);
}
let toastTimer: number | undefined;

function renderHud() {
  $('#is-clock').textContent = `${sim.clock.label} · Day ${Math.min(sim.clock.day, SEASON_DAYS)} of ${SEASON_DAYS}`;
  $('#is-coin').textContent = `${sim.treasury} coin`;
  const rep = sim.reputation;
  $('#is-rep').textContent = `${'★'.repeat(Math.round(rep))}${'☆'.repeat(5 - Math.round(rep))} ${rep.toFixed(1)}`;
  document.querySelectorAll('.is-speed').forEach((b) => {
    b.classList.toggle('active', sim.clock.speed === Number((b as HTMLElement).dataset.speed));
  });

  const roster = $('#is-roster');
  if (sim.tourists.length === 0) {
    roster.innerHTML = '<div class="dim">No visitors on the island.</div>';
  } else {
    roster.innerHTML = sim.tourists
      .map((t) => {
        const wants = t.def.wants
          .map((w) => (t.wantsMet.includes(w) ? `<s>${WANT_LABEL[w]}</s>` : WANT_LABEL[w]))
          .join(', ');
        const mood = t.scared ? '😱' : t.wantsMet.length === t.def.wants.length ? '😊' : '🙂';
        return `<div class="is-tourist">${mood} <b>${t.def.name}</b><br><span class="dim">wants ${wants}</span></div>`;
      })
      .join('');
  }
}

function renderLabels() {
  const el = $('#is-labels');
  el.innerHTML = '';
  for (const person of [...sim.locals, ...sim.tourists]) {
    const dist = Math.abs(person.x - sim.mayor.x) + Math.abs(person.y - sim.mayor.y);
    if (dist > 4) continue;
    const p = renderer.pos(person.x, person.y);
    if (!p.visible) continue;
    const label = document.createElement('div');
    label.className = 'is-label';
    label.style.left = `${p.sx + CELL / 2}px`;
    label.style.top = `${p.sy - 6}px`;
    label.textContent = 'phase' in person ? `${person.def.name} (visitor)` : `${person.def.name} · ${(person as LocalState).activity}`;
    el.appendChild(label);
  }
}

function maybeReport() {
  if (!sim.seasonOver || reportShown) return;
  reportShown = true;
  const r = sim.seasonReport();
  const verdict = r.failed
    ? 'The ferry has stopped coming. The mainland believes the stories, because the stories were true. The gulls have the square to themselves.'
    : r.rep >= 4
      ? 'Gullshead is, against all sense, a destination. The mainland papers call it “charming” and “probably fine.”'
      : r.rep >= 2.5
        ? 'The island limps along, half-loved. Some visitors return. Some write letters. The bell waits.'
        : 'The island survives, barely. The reviews use the word “atmosphere” in a way that is not a compliment.';
  const el = $('#is-report');
  el.innerHTML = `<div class="modal"><div class="modal-title">END OF SEASON — GULLSHEAD ISLAND</div>
    <div class="modal-body">Reputation: ${r.rep.toFixed(1)} ★ · Treasury: ${r.coin} coin · Curse pages found: ${r.pages} of 3<br><br>${verdict}<br><br><span class="dim">Refresh the page to run another season.</span></div></div>`;
  el.style.display = 'flex';
}

// ---------------- Layout ----------------

const LAYOUT = `
<div id="is-start">
  <h1>GULLSHEAD</h1>
  <div class="subtitle">an island of considerable charm and one (1) problem</div>
  <div class="start-box">
    <button id="is-start-mock">Take office — free, scripted voices</button>
    <button id="is-start-live">Take office — live voices (AI)</button>
    <label>API key (live voices only)</label>
    <input id="is-key" type="password" placeholder="sk-ant-…">
    <div id="is-start-error" class="error"></div>
    <div class="dim" style="margin-top:16px">
    You are the new mayor. Tourists arrive by ferry at nine wanting food, fun, history, and rest — build things and they pay.
    At night the island is <i>otherwise occupied</i>. Tourists who see it tell the mainland, and the mainland stops coming.<br><br>
    Walk: WASD · Act: E · Pause: Space · Speed: 1/2/3<br>
    <a href="index.html">prototype 1 — the text game</a> · <a href="town.html">prototype 2 — the clockwork town</a></div>
  </div>
</div>

<div id="is-game" style="display:none">
  <header>
    <span id="is-clock" class="chip"></span>
    <button class="is-speed" data-speed="0">⏸</button>
    <button class="is-speed" data-speed="1">1x</button>
    <button class="is-speed" data-speed="2">2x</button>
    <button class="is-speed" data-speed="4">4x</button>
    <span id="is-coin" class="chip"></span>
    <span id="is-rep" class="chip"></span>
    <button id="is-journal-btn">Journal</button>
    <button id="is-gazette-btn">Gazette</button>
  </header>
  <div id="is-main">
    <div id="is-stage">
      <canvas id="is-canvas"></canvas>
      <div id="is-labels"></div>
      <div id="is-menu" class="is-panel" style="display:none"></div>
      <div id="is-board" class="is-panel" style="display:none"></div>
      <div id="is-journal" class="is-panel" style="display:none"></div>
      <div id="is-gazette" class="is-panel" style="display:none"></div>
      <div id="is-talk" class="is-panel" style="display:none">
        <div id="is-talk-name" class="panel-head"></div>
        <div id="is-talk-body"></div>
        <div id="is-talk-row"><input id="is-talk-input" placeholder="say something back — plain words work"><button id="is-talk-send">Say it</button></div>
        <button id="is-talk-close">Tip your hat and go</button>
      </div>
      <div id="is-toast" style="display:none"></div>
      <div id="is-report" style="display:none"></div>
    </div>
    <aside id="is-side">
      <div class="panel-head">Visitors today</div>
      <div id="is-roster"></div>
    </aside>
  </div>
</div>
`;

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.classList?.contains('is-speed') && sim) {
    sim.clock.speed = Number(t.dataset.speed) as 0 | 1 | 2 | 4;
  }
});

boot();
