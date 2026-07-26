// ============================================================
// The whole interface: start screen, scene, prophecy ledger,
// the year-grid (jump anywhere), margin notes, modals, and the
// designer's dial panel. Vanilla DOM — no framework.
// ============================================================

import { Engine, type TurnResult } from '../game/engine';
import { MockClerk, MockStoryteller } from '../mock/mock';
import { FIXTURE_SHEET } from '../mock/fixture';
import { ClaudeClient } from '../ai/client';
import { LiveClerk, LiveStoryteller } from '../ai/storyteller';
import { generateEraSheet } from '../ai/generator';
import { DEFAULT_DIALS, type Dials, type EraSheet, type Prophecy } from '../core/types';
import { renderScene, drawPortrait, SCENE_W, SCENE_H } from './art';
import { saveRun, loadRun, clearRun, exportRun } from '../game/save';
import { GameRecord } from '../core/record';

type Mode = 'mock' | 'live';

let engine: Engine | null = null;
let client: ClaudeClient | null = null;
let mode: Mode = 'mock';
let dials: Dials = { ...DEFAULT_DIALS };
let lastProse = '';
let busy = false;
let revealHiddenFaces = false;

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function boot() {
  document.body.innerHTML = LAYOUT;
  $('#start-mock').onclick = () => startNewRun('mock');
  $('#start-live').onclick = () => startNewRun('live');
  ($('#api-key') as HTMLInputElement).value = localStorage.getItem('anseld.apiKey') ?? '';
  const saved = loadRun();
  if (saved) {
    const btn = $('#start-resume');
    btn.style.display = 'inline-block';
    btn.onclick = () => resumeRun();
  }
  $('#designer-toggle').onclick = toggleDesigner;
  $('#designer-close').onclick = toggleDesigner;
  document.addEventListener('keydown', (e) => {
    if (e.key === '`') toggleDesigner();
  });
}

// ---------------- Run lifecycle ----------------

async function startNewRun(m: Mode) {
  mode = m;
  clearRun();
  dials = { ...DEFAULT_DIALS, ...readDialInputs() };

  let sheet: EraSheet;
  if (mode === 'live') {
    const key = ($('#api-key') as HTMLInputElement).value.trim();
    if (!key) {
      $('#start-error').textContent = 'A live run needs an API key. Paste one, or play the mock run.';
      return;
    }
    localStorage.setItem('anseld.apiKey', key);
    client = new ClaudeClient(key);
    setStartStatus('The era is being written. This takes a moment and a fraction of a cent…');
    try {
      sheet = await generateEraSheet(client, dials);
    } catch (err) {
      setStartStatus('');
      $('#start-error').textContent = `The era refused to generate: ${String(err).slice(0, 300)}`;
      return;
    }
  } else {
    client = null;
    sheet = structuredClone(FIXTURE_SHEET);
  }

  engine = buildEngine(sheet, undefined);
  setStartStatus('');
  showBriefing(sheet);
}

/** The Telling Opens — orientation before the first scene. */
function showBriefing(sheet: EraSheet) {
  const startHost = Engine.defaultStartingHost(sheet);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal briefing">
      <div class="modal-title">The Telling Opens — ${escapeHtml(sheet.townName)}, Years ${sheet.eraStart}–${sheet.eraEnd}</div>
      <div class="modal-body">
        <p>${escapeHtml(sheet.overview)}</p>
        <div class="panel-head">The one you are here to end</div>
        <p><b>${escapeHtml(sheet.antagonist.name)}</b>, ${escapeHtml(sheet.antagonist.title)}. ${escapeHtml(sheet.antagonist.nature)}</p>
        <p class="brief-rule">They cannot be possessed. They cannot be reasoned with. They cannot be killed by force. Only the prophecy ends them.</p>
        <div class="panel-head">The prime prophecy — the way they end</div>
        <p class="p-poetic">“${escapeHtml(sheet.primePoetic)}”</p>
        ${sheet.primeConditions.map((p) => `<p class="brief-cond">— <span class="p-poetic">“${escapeHtml(p.poetic)}”</span></p>`).join('')}
        <p>Make all of them stand, in any order, by any means, and the count closes.</p>
        <div class="panel-head">The loose prophecies — all will come true</div>
        ${sheet.looseProphecies.map((p) => `<p class="brief-cond">— <span class="p-poetic">“${escapeHtml(p.poetic)}”</span></p>`).join('')}
        <p>You control neither who, nor when, nor whether they help — unless you aim one. Left unaimed, the world spends them carelessly.</p>
        <div class="panel-head">How the telling works</div>
        <p class="brief-rule">— You are unbodied. The era grid on the right is the whole fifteen years: click any year of any living body to enter it. Fresh windows are free.</p>
        <p class="brief-rule">— Re-entering a moment you already lived, or a body you watched die, costs a <b>scar</b>. You are always warned first. Scars are the only way to lose.</p>
        <p class="brief-rule">— What a host learns while you wear them is yours forever, in every body. The hosts keep nothing.</p>
        <p class="brief-rule">— Speak plainly in the text box, or take a listed choice. The town answers. Questions ("what do I know about…") are thought — free, private, and they touch nothing. Commands are acts, and acts leave marks.</p>
        <div class="panel-head">You wake as</div>
        <p><b>${escapeHtml(startHost?.name ?? '?')}</b> — ${escapeHtml(startHost?.role ?? '')}. ${escapeHtml(startHost?.seed ?? '')}</p>
      </div>
      <div class="modal-actions"><button id="brief-begin">Begin the telling</button></div>
    </div>`;
  document.body.appendChild(overlay);
  (overlay.querySelector('#brief-begin') as HTMLButtonElement).onclick = async () => {
    overlay.remove();
    showGame();
    await guarded(async () => {
      const result = await engine!.startRun();
      applyResult(result);
    });
  };
}

function resumeRun() {
  const saved = loadRun();
  if (!saved) return;
  mode = saved.mode;
  dials = saved.dials;
  if (mode === 'live') {
    const key = localStorage.getItem('anseld.apiKey') ?? '';
    if (!key) {
      $('#start-error').textContent = 'The saved run is live-mode and no API key is stored.';
      return;
    }
    client = new ClaudeClient(key);
  }
  engine = buildEngine(saved.sheet, saved.record);
  engine.restoreUi(saved.ui);
  lastProse = saved.ui.lastProse;
  showGame();
  renderAll({ prose: lastProse, choices: engine.uiState().lastChoices, notes: [], state: engine.state() });
}

function buildEngine(sheet: EraSheet, record: GameRecord | undefined): Engine {
  if (mode === 'live' && client) {
    return new Engine(
      sheet, dials,
      new LiveStoryteller(client, () => dials.storytellerModel),
      new LiveClerk(client, () => dials.clerkModel),
      record,
    );
  }
  return new Engine(sheet, dials, new MockStoryteller(), new MockClerk(), record);
}

function persist() {
  if (!engine) return;
  saveRun({
    mode,
    sheet: engine.sheet,
    dials,
    recordJson: engine.referee.record.serialize(),
    ui: { ...engine.uiState(), lastProse },
  });
}

// ---------------- Turn handling ----------------

async function guarded(fn: () => Promise<void>) {
  if (busy) return;
  busy = true;
  $('#busy').style.display = 'block';
  try {
    await fn();
  } catch (err) {
    addNote('system', `Something failed: ${String(err).slice(0, 300)}`);
  } finally {
    busy = false;
    $('#busy').style.display = 'none';
  }
}

function applyResult(result: TurnResult) {
  lastProse = result.prose;
  renderAll(result);
  persist();
}

async function act(action: string) {
  if (!engine || busy) return;
  await guarded(async () => {
    const result = await engine!.act(action);
    applyResult(result);
  });
}

// ---------------- Rendering ----------------

function showGame() {
  $('#start-screen').style.display = 'none';
  $('#game-screen').style.display = 'grid';
  $('#era-title').textContent = engine ? `${engine.sheet.townName}, Years ${engine.sheet.eraStart}–${engine.sheet.eraEnd}` : '';
  if (engine) {
    $('#town-body').innerHTML =
      `<p>${escapeHtml(engine.sheet.overview)}</p>` +
      `<div class="panel-head">The one you are here to end</div>` +
      `<p><b>${escapeHtml(engine.sheet.antagonist.name)}</b>, ${escapeHtml(engine.sheet.antagonist.title)}. ${escapeHtml(engine.sheet.antagonist.nature)}</p>` +
      `<div class="panel-head">Places</div>` +
      engine.sheet.locations
        .map((l) => `<div class="k-item">${escapeHtml(l.name)}${l.sealed ? ' — sealed (no human host passes)' : ''}<span class="dim"> · ${escapeHtml(l.description)}</span></div>`)
        .join('');
  }
  renderDesigner();
}

function renderAll(result: TurnResult) {
  const s = result.state;
  const host = engine!.currentHost();

  // Top bar.
  $('#year-chip').textContent = `Year ${s.year}`;
  $('#host-chip').textContent = host ? `${host.name} — ${host.role}${host.watched ? ' (watched)' : ''}` : 'Unbodied (choose a host from the grid)';
  renderScars(s.scars);
  $('#cost-chip').textContent = client ? `$${client.totalCostUsd().toFixed(3)}` : 'mock — $0';

  // Scene.
  const canvas = $('#scene') as HTMLCanvasElement;
  if (host) {
    const loc = engine!.referee.locationById(engine!.currentLocationId()) ?? engine!.sheet.locations[0];
    renderScene(canvas, {
      roomArtId: loc.roomArtId, sealed: loc.sealed,
      portraitId: host.portraitId, watched: host.watched, hostName: host.name,
      dead: false,
    });
    $('#scene-caption').textContent = `${loc.name}${loc.sealed ? ' — sealed' : ''}`;
  } else {
    const loc = engine!.referee.locationById(engine!.currentLocationId()) ?? engine!.sheet.locations[0];
    renderScene(canvas, { roomArtId: loc.roomArtId, sealed: loc.sealed, portraitId: 'face-1', watched: false, hostName: '', dead: true });
    $('#scene-caption').textContent = 'No body. The Law of Flesh holds — enter someone.';
  }

  // Prose + notes.
  $('#prose').textContent = result.prose;
  const notesEl = $('#notes');
  notesEl.innerHTML = '';
  for (const n of result.notes) {
    const div = document.createElement('div');
    div.className = `note note-${n.kind}`;
    div.textContent = n.text;
    notesEl.appendChild(div);
  }

  // Choices.
  const choicesEl = $('#choices');
  choicesEl.innerHTML = '';
  if (s.outcome === 'playing' && host) {
    for (const label of result.choices) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = label;
      b.onclick = () => act(label);
      choicesEl.appendChild(b);
    }
  }
  ($('#free-text') as HTMLInputElement).disabled = s.outcome !== 'playing' || !host;
  $('#free-send').toggleAttribute('disabled', s.outcome !== 'playing' || !host);

  renderProphecies(s.prophecies);
  renderGrid();
  renderKnowledge(s.knowledge, s.unwitnessed);
  renderLedger();
  renderDesignerLog();

  if (s.outcome !== 'playing') {
    $('#end-banner').style.display = 'block';
    $('#end-banner').textContent = s.outcome === 'won' ? `WON — ${s.outcomeNote}` : `LOST — ${s.outcomeNote}`;
    $('#end-banner').className = s.outcome === 'won' ? 'end won' : 'end lost';
  } else {
    $('#end-banner').style.display = 'none';
  }
}

function renderScars(scars: number) {
  const el = $('#scar-chip');
  const marks = Array.from({ length: dials.scarCap }, (_, i) => (i < scars ? '𝍸' : '·')).join(' ');
  el.innerHTML = `scars <span class="tally">${marks}</span> ${scars}/${dials.scarCap}`;
  el.className = scars >= dials.tier3At ? 'chip danger' : scars >= dials.tier2At ? 'chip warn' : 'chip';
}

function renderProphecies(prophecies: Prophecy[]) {
  const el = $('#prophecies');
  el.innerHTML = '';
  const prime = prophecies.filter((p) => p.kind === 'prime');
  const loose = prophecies.filter((p) => p.kind === 'loose');

  const h1 = document.createElement('div');
  h1.className = 'panel-head';
  h1.textContent = `The Prime — ${engine!.sheet.primePoetic}`;
  el.appendChild(h1);
  for (const p of prime) el.appendChild(prophecyRow(p));

  const h2 = document.createElement('div');
  h2.className = 'panel-head';
  h2.textContent = 'Loose Prophecies';
  el.appendChild(h2);
  for (const p of loose) el.appendChild(prophecyRow(p));
}

function prophecyRow(p: Prophecy): HTMLElement {
  const row = document.createElement('div');
  row.className = `prophecy state-${p.state}`;
  const stateLabel =
    p.state === 'unaimed' ? (p.kind === 'prime' ? 'unmet' : 'unaimed')
    : p.state === 'warned' ? 'the ink is moving'
    : p.state === 'aimed' ? 'aimed'
    : p.state === 'decayed' ? 'lost to the world'
    : p.state === 'fulfilled' ? (p.kind === 'prime' ? 'STANDS' : 'came true')
    : p.state;

  let html = `<div class="p-poetic">“${escapeHtml(p.poetic)}”</div><div class="p-state">${stateLabel}</div>`;
  const boundRoles = p.roles.filter((r) => r.boundTo);
  if (boundRoles.length > 0) {
    html += `<div class="p-roles">${boundRoles.map((r) => `${escapeHtml(r.label)} = ${escapeHtml(r.boundTo!)}${r.penciled ? ' (penciled)' : ''}`).join(' · ')}</div>`;
  }
  if (p.state === 'decayed' && p.sealedSketch) {
    html += `<div class="p-sketch">${escapeHtml(p.sealedSketch)}</div>`;
  }
  if (revealHiddenFaces) {
    html += `<div class="p-hidden">[hidden face] ${escapeHtml(p.hiddenCondition)}${p.sealedSketch ? ` — [sealed] ${escapeHtml(p.sealedSketch)}` : ''}</div>`;
  }
  row.innerHTML = html;

  if (p.kind === 'loose' && (p.state === 'unaimed' || p.state === 'warned')) {
    const b = document.createElement('button');
    b.className = 'aim-btn';
    b.textContent = 'Aim';
    b.onclick = () => openAimModal(p);
    row.appendChild(b);
  }
  return row;
}

/** The year grid: every host × every year. Jump anywhere the flesh allows. */
function renderGrid() {
  const el = $('#grid');
  const sheet = engine!.sheet;
  const s = engine!.state();
  const occupied = new Set(engine!.referee.record.occupiedWindows().map((w) => `${w.hostId}@${w.year}`));
  const dead = engine!.referee.record.deadHosts();
  const years: number[] = [];
  for (let y = sheet.eraStart; y <= sheet.eraEnd; y++) years.push(y);

  let html = '<table><tr><th></th>' + years.map((y) => `<th>${y % 100}</th>`).join('') + '</tr>';
  for (const h of sheet.hosts) {
    html += `<tr><td class="g-name" title="${escapeHtml(h.role)}">${escapeHtml(h.name)}${dead.has(h.id) ? ' †' : ''}</td>`;
    for (const y of years) {
      const alive = y >= h.birthYear && y <= h.deathYear;
      const here = s.currentHostId === h.id && s.year === y;
      const occ = occupied.has(`${h.id}@${y}`);
      const cls = here ? 'g-cell here' : occ ? 'g-cell occ' : alive ? 'g-cell alive' : 'g-cell';
      html += `<td class="${cls}" data-host="${h.id}" data-year="${y}">${here ? '◉' : occ ? '·' : alive ? '' : '×'}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  el.innerHTML = html;

  el.querySelectorAll('.g-cell.alive, .g-cell.occ').forEach((cell) => {
    (cell as HTMLElement).onclick = () => {
      const hostId = (cell as HTMLElement).dataset.host!;
      const year = Number((cell as HTMLElement).dataset.year!);
      requestJump(hostId, year);
    };
  });
}

function renderKnowledge(knowledge: string[], unwitnessed: Array<{ fromYear: number; toYear: number }>) {
  const el = $('#knowledge');
  el.innerHTML = '<div class="panel-head">What you know</div>';
  if (knowledge.length === 0) {
    el.innerHTML += '<div class="k-item dim">Nothing yet that a body did not already know.</div>';
  }
  for (const k of knowledge) {
    el.innerHTML += `<div class="k-item">${escapeHtml(k)}</div>`;
  }
  if (unwitnessed.length > 0) {
    el.innerHTML += `<div class="panel-head">Unwitnessed time</div>`;
    for (const u of unwitnessed) {
      el.innerHTML += `<div class="k-item unwit">Years ${u.fromYear}–${u.toYear}: overwritten. No one witnessed them.</div>`;
    }
  }
}

function renderLedger() {
  const el = $('#ledger-body');
  const rows = engine!.referee.record
    .all()
    .map((e) => {
      const unmade = 'unmade' in e && (e as { unmade?: boolean }).unmade;
      let text = '';
      switch (e.kind) {
        case 'run-started': text = `The telling opens, Year ${e.year}.`; break;
        case 'possess': text = `Entered ${hostName(e.hostId)}, Year ${e.year}.`; break;
        case 'exit-host': text = `Left ${hostName(e.hostId)}, unsteered.`; break;
        case 'jump': text = `Year ${e.fromYear} → Year ${e.toYear}.`; break;
        case 'turn': text = `Y${e.year} ${hostName(e.hostId)}: ${e.playerAction}`; break;
        case 'host-died': text = `${hostName(e.hostId)} died — ${e.cause}`; break;
        case 'rewind': text = `REWIND (${e.mode}) to Year ${e.toYear}.`; break;
        case 'scar': text = `SCAR — ${e.note}`; break;
        case 'unwitnessed': text = `Years ${e.fromYear}–${e.toYear} unwitnessed.`; break;
        case 'prophecy-contact': text = `Prophecy ${e.prophecyId}: ${e.result}.`; break;
        case 'prophecy-aimed': text = `Prophecy ${e.prophecyId} aimed: ${e.declaration}`; break;
        case 'prophecy-fulfilled': text = `Prophecy ${e.prophecyId} fulfilled — ${e.ruling}`; break;
        case 'knowledge': text = `Learned: ${e.text}`; break;
        case 'prophecy-reset': text = `DESIGNER OVERRIDE — ${e.prophecyId} reset (${e.note}).`; break;
        case 'run-ended': text = `THE RUN ${e.outcome.toUpperCase()} — ${e.note}`; break;
      }
      return `<div class="l-row${unmade ? ' unmade' : ''}"><span class="l-seq">${e.seq}</span> ${escapeHtml(text)}</div>`;
    })
    .join('');
  el.innerHTML = rows || '<div class="dim">Empty.</div>';
}

function hostName(id: string): string {
  return engine?.referee.hostById(id)?.name ?? id;
}

// ---------------- Jump / rewind ----------------

async function requestJump(hostId: string, year: number) {
  if (!engine || busy) return;
  const s = engine.state();
  if (s.outcome !== 'playing') return;
  await guarded(async () => {
    const res = await engine!.requestJump(hostId, year);
    if (res.kind === 'refused') {
      addNote('system', res.reason);
      return;
    }
    if (res.kind === 'needs-confirmation') {
      const entry = res.entry;
      if (entry.type !== 'rewind-window' && entry.type !== 'rewind-dead-host') return;
      openModal(
        'The Open Door',
        `${res.warning}\n\nScar ${engine!.state().scars + 1} of ${dials.scarCap}. Enter anyway?`,
        [
          { label: 'Enter — take the scar', danger: true, fn: async () => {
              const result = await engine!.confirmRewind(entry, hostId, year);
              applyResult(result);
            } },
          { label: 'Stay out', fn: async () => {} },
        ],
      );
      return;
    }
    applyResult(res.result);
  });
}

// ---------------- Aiming ----------------

function openAimModal(p: Prophecy) {
  const body = document.createElement('div');
  body.innerHTML =
    `<div class="p-poetic big">“${escapeHtml(p.poetic)}”</div>` +
    `<p class="dim">Aim it in your own words. Every blank must be named. Aimed words do not come back.</p>` +
    `<label>Your declaration</label><textarea id="aim-decl" rows="2" placeholder="Say what will happen, and to whom."></textarea>` +
    p.roles
      .map(
        (r, i) =>
          `<label>${escapeHtml(r.label)}${r.penciled && r.boundTo ? ` <span class="dim">(the world penciled in: ${escapeHtml(r.boundTo)})</span>` : ''}</label>` +
          `<input id="aim-role-${i}" placeholder="a name">`,
      )
      .join('');

  openModal('Aim a prophecy', body, [
    {
      label: 'Aim — irrevocable',
      danger: true,
      fn: async () => {
        const declaration = (document.getElementById('aim-decl') as HTMLTextAreaElement).value.trim();
        const bindings: Record<string, string> = {};
        p.roles.forEach((r, i) => {
          bindings[r.label] = (document.getElementById(`aim-role-${i}`) as HTMLInputElement).value.trim();
        });
        const res = engine!.aim(p.id, declaration || p.poetic, bindings);
        if (!res.ok) {
          addNote('system', res.reason ?? 'The aim failed.');
        } else {
          addNote('prophecy-warned', `Aimed: “${p.poetic}” — ${declaration || 'as written'}. The world now bends toward it.`);
          renderProphecies(engine!.state().prophecies);
          persist();
        }
      },
    },
    { label: 'Not yet', fn: async () => {} },
  ]);
}

// ---------------- Designer panel ----------------

function toggleDesigner() {
  const el = $('#designer');
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
  renderDesigner();
}

function readDialInputs(): Partial<Dials> {
  const get = (id: string) => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
  const gets = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
  const out: Partial<Dials> = {};
  if (!Number.isNaN(get('d-scarCap'))) out.scarCap = get('d-scarCap');
  if (!Number.isNaN(get('d-tier2'))) out.tier2At = get('d-tier2');
  if (!Number.isNaN(get('d-tier3'))) out.tier3At = get('d-tier3');
  if (!Number.isNaN(get('d-osric'))) out.osricIntensity = get('d-osric');
  if (!Number.isNaN(get('d-decay'))) out.contactsToDecay = get('d-decay');
  if (!Number.isNaN(get('d-loose'))) out.looseProphecyCount = get('d-loose');
  if (gets('d-model-st')) out.storytellerModel = gets('d-model-st')!;
  if (gets('d-model-clerk')) out.clerkModel = gets('d-model-clerk')!;
  if (gets('d-model-gen')) out.generatorModel = gets('d-model-gen')!;
  return out;
}

function renderDesigner() {
  const el = $('#designer-dials');
  el.innerHTML = `
    <div class="panel-head">Dials (live — they apply immediately)</div>
    ${dial('d-scarCap', 'Scar cap (loss)', dials.scarCap, 1, 15)}
    ${dial('d-tier2', 'Tier 2 at (localise)', dials.tier2At, 1, 15)}
    ${dial('d-tier3', 'Tier 3 at (predict)', dials.tier3At, 1, 15)}
    ${dial('d-osric', 'Osric intensity 0–3', dials.osricIntensity, 0, 3)}
    ${dial('d-decay', 'Contacts to decay', dials.contactsToDecay, 1, 5)}
    ${dial('d-loose', 'Loose prophecies (next run)', dials.looseProphecyCount, 1, 6)}
    <label>Storyteller model</label><input id="d-model-st" value="${dials.storytellerModel}">
    <label>Clerk model</label><input id="d-model-clerk" value="${dials.clerkModel}">
    <label>Generator model</label><input id="d-model-gen" value="${dials.generatorModel}">
    <label class="check"><input type="checkbox" id="d-reveal" ${revealHiddenFaces ? 'checked' : ''}> Reveal hidden faces & sealed sketches (designer eyes only)</label>
    ${engine ? `<div class="panel-head">Prophecy repair (playtest overrides — these write to the Ledger)</div>` +
      engine.state().prophecies
        .filter((p) => p.state !== 'unaimed')
        .map((p) => `<div class="l-row">${escapeHtml(p.id)} — ${p.state} <button class="d-reset" data-p="${p.id}">reset to unaimed</button></div>`)
        .join('') : ''}
    <button id="d-apply">Apply dials</button>
    <button id="d-export">Copy save to clipboard</button>
    <button id="d-abandon" class="danger-btn">Abandon run</button>
  `;
  (document.getElementById('d-apply') as HTMLButtonElement).onclick = () => {
    Object.assign(dials, readDialInputs());
    if (engine) {
      engine.dials = dials;
      engine.referee.dials = dials;
      renderAll({ prose: lastProse, choices: engine.uiState().lastChoices, notes: [], state: engine.state() });
      persist();
    }
    addNote('system', 'Dials applied.');
  };
  el.querySelectorAll('.d-reset').forEach((btn) => {
    (btn as HTMLButtonElement).onclick = () => {
      const id = (btn as HTMLElement).dataset.p!;
      engine!.referee.resetProphecy(id, 'designer override');
      addNote('system', `Designer override: ${id} reset to unaimed. The override is on the Ledger.`);
      renderProphecies(engine!.state().prophecies);
      renderLedger();
      renderDesigner();
      persist();
    };
  });
  (document.getElementById('d-reveal') as HTMLInputElement).onchange = (e) => {
    revealHiddenFaces = (e.target as HTMLInputElement).checked;
    if (engine) renderProphecies(engine.state().prophecies);
  };
  (document.getElementById('d-export') as HTMLButtonElement).onclick = async () => {
    const data = exportRun();
    if (data) await navigator.clipboard.writeText(data);
    addNote('system', data ? 'Save copied to clipboard.' : 'No save exists.');
  };
  (document.getElementById('d-abandon') as HTMLButtonElement).onclick = () => {
    clearRun();
    location.reload();
  };
  renderDesignerLog();
}

function dial(id: string, label: string, value: number, min: number, max: number): string {
  return `<label>${label}</label><input id="${id}" type="number" min="${min}" max="${max}" value="${value}">`;
}

function renderDesignerLog() {
  const el = document.getElementById('designer-log');
  if (!el) return;
  if (!client) {
    el.innerHTML = '<div class="panel-head">AI call log</div><div class="dim">Mock mode — no calls, no cost.</div>';
    return;
  }
  const rows = client.log
    .map(
      (e) =>
        `<div class="l-row"><span class="l-seq">${e.kind}</span> ${escapeHtml(e.summary)} — ${e.inputTokens}in/${e.outputTokens}out — $${e.costUsd.toFixed(4)}</div>`,
    )
    .join('');
  el.innerHTML =
    `<div class="panel-head">AI call log — total $${client.totalCostUsd().toFixed(3)}</div>` +
    (rows || '<div class="dim">No calls yet.</div>');
}

// ---------------- Shared bits ----------------

function addNote(kind: string, text: string) {
  const div = document.createElement('div');
  div.className = `note note-${kind}`;
  div.textContent = text;
  $('#notes').appendChild(div);
}

function setStartStatus(text: string) {
  $('#start-status').textContent = text;
}

function openModal(title: string, body: string | HTMLElement, actions: Array<{ label: string; danger?: boolean; fn: () => Promise<void> }>) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const box = document.createElement('div');
  box.className = 'modal';
  const h = document.createElement('div');
  h.className = 'modal-title';
  h.textContent = title;
  box.appendChild(h);
  if (typeof body === 'string') {
    const p = document.createElement('div');
    p.className = 'modal-body';
    p.textContent = body;
    box.appendChild(p);
  } else {
    body.className = 'modal-body';
    box.appendChild(body);
  }
  const row = document.createElement('div');
  row.className = 'modal-actions';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.danger) b.className = 'danger-btn';
    b.onclick = () => {
      // Start the action first: its synchronous prefix reads the modal's
      // inputs, which must still be in the DOM. Then tear the modal down.
      const pending = a.fn();
      overlay.remove();
      void guarded(() => pending);
    };
    row.appendChild(b);
  }
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Free text wiring (attached once the layout exists).
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'free-send') submitFreeText();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).id === 'free-text') submitFreeText();
});

/** Questions are thought; commands are acts. Thought is free and touches nothing. */
function looksLikeQuestion(v: string): boolean {
  return /^(what|who|whom|where|when|why|how|did|do|does|have|has|had|am|is|are|was|were|can|could|should|would)\b/i.test(v) || v.endsWith('?');
}

function submitFreeText() {
  const input = document.getElementById('free-text') as HTMLInputElement | null;
  if (!input || input.disabled) return;
  const v = input.value.trim();
  if (!v) return;
  input.value = '';
  if (looksLikeQuestion(v)) {
    void guarded(async () => {
      const result = await engine!.consider(v);
      renderAll(result); // no persist: a thought is not a page
    });
    return;
  }
  act(v);
}

// ---------------- Layout ----------------

const LAYOUT = `
<div id="start-screen">
  <h1>ANSELD</h1>
  <div class="subtitle">a systems-test prototype · the machine made visible</div>
  <div class="start-box">
    <button id="start-mock">Mock run — Saltmere, scripted, no AI, free</button>
    <button id="start-live">Live run — a fresh era, written as you play</button>
    <button id="start-resume" style="display:none">Resume the saved run</button>
    <label>API key (live runs only — stays on this machine)</label>
    <input id="api-key" type="password" placeholder="sk-ant-…">
    <div id="start-status" class="dim"></div>
    <div id="start-error" class="error"></div>
  </div>
</div>

<div id="game-screen" style="display:none">
  <header>
    <span id="era-title"></span>
    <span id="year-chip" class="chip"></span>
    <span id="host-chip" class="chip"></span>
    <span id="scar-chip" class="chip"></span>
    <span id="cost-chip" class="chip"></span>
    <button id="designer-toggle" title="designer panel (\`)">⚙</button>
  </header>

  <main>
    <section id="left">
      <canvas id="scene" width="${SCENE_W}" height="${SCENE_H}"></canvas>
      <div id="scene-caption" class="dim"></div>
      <div id="end-banner" style="display:none"></div>
      <div id="prose"></div>
      <div id="notes"></div>
      <div id="busy" style="display:none">the ink is drying…</div>
      <div id="choices"></div>
      <div id="free-row">
        <input id="free-text" placeholder="or do something else — commands act, questions only recall">
        <button id="free-send">Do it</button>
      </div>
    </section>

    <aside id="right">
      <details class="panel"><summary>The town — what is known of it</summary><div id="town-body"></div></details>
      <div id="prophecies" class="panel"></div>
      <div class="panel">
        <div class="panel-head">The era — click a year to enter a body</div>
        <div id="grid"></div>
        <div class="dim gridkey">◉ now · dot = a window you occupied (re-entry scars) · † died in play · × not alive</div>
      </div>
      <div id="knowledge" class="panel"></div>
      <details class="panel"><summary>The Ledger (every page, including the unmade)</summary><div id="ledger-body"></div></details>
    </aside>
  </main>
</div>

<div id="designer" style="display:none">
  <button id="designer-close" style="float:right">✕ close</button>
  <div class="panel-head big">Designer panel — the dials are the remaining design work</div>
  <div id="designer-dials"></div>
  <div id="designer-log"></div>
</div>
`;

export { drawPortrait }; // (used by future host-list UI; keeps the art shelf single-sourced)
