# ANSELD — DESIGN DOCUMENT, PROTOTYPE AMENDMENT

Version 0.1 of the systems-test prototype. Written 2026-07-26, the day the machine was built.

This document amends `ANSELD — DESIGN DOCUMENT.docx` (the campaign record, written at Year 200, Scar 1). The original stands untouched; it is a record of play and it should keep its scars. This amendment records what was decided in order to build a playable prototype, what the prototype currently is, and what is genuinely still open. In the original's spirit: unflattering where unflattering is accurate.

The purpose of the prototype is stated plainly: **to test the game systems** — scars, rewinds, prophecy aiming and decay, the win and loss machinery — with mechanics enforced by code instead of remembered by a storyteller. The original document's Section 6 is a confession list of what happens when the author is also the bookkeeper. This build's founding rule answers it:

**Code is the referee. The AI is only the storyteller.**

---

## 1. RESOLUTIONS OF THE ORIGINAL'S OPEN DECISIONS (§8)

Every item from the original's ranked list, ruled.

| # | Original decision | Ruling |
|---|---|---|
| 1 | Cost of re-entering a dead host (§4b) | **Scar only (Option D), unified with 4a.** Every rewind of any kind — occupied window or dead host — costs exactly one scar. The layered A+C+D recommendation was considered and rejected in favor of one currency. Option C survives demoted: overwritten time is *recorded* as unwitnessed — a fact, not a cost (see §2.3). Option B (the Doubling) is reserved as a possible targeted event, not law. The free save button is closed. |
| 2 | Loss condition | **The scar cap is the only loss.** Reach it and Osric stops seeking a cause, finds the pattern, and the run ends. No time-deadline loss; the player can take as long as quiet allows. Cap value is a designer dial (default 7). |
| 3 | Prophecy decay mechanism (§6.8) | **Decay on contact.** Each prophecy is born with trigger subjects. Events touching an unaimed prophecy's subjects: first contact *warns* (visible stir), second contact *locks it carelessly*. The threshold is a dial (default 2). The careless outcome is not improvised at the moment of harm — it was sealed at the prophecy's birth (§2.4). The threat is no longer empty; it is enforced by code that cannot forget to enforce it. |
| 4 | Scar escalation implementation (§4a) | **Three tiers with concrete, code-enforced effects; every number is a dial.** Tier 1 (noise): nothing. Tier 2 (localise, default at 3): hosts whose home is anywhere the player has worked arrive *watched* — flagged in the interface and in the storyteller's instructions; audits cluster. Tier 3 (predict, default at 5): the storyteller is directed to have Osric pre-position — at least one avenue closed before the player arrives. An intensity dial (0–3) scales how physically present his attention becomes. |
| 5 | Retroactive cost cap | **Moot.** All costs apply forward from adoption. Nothing is charged backward, ever. The prototype starts fresh; the question dissolves. |
| 6 | Does Osric address the player? | **Deliberately undecided — this is what the dials are for.** The proposed ladder (never directly → sentences aimed past hosts → marginalia → once, the offer) was NOT adopted. The storyteller improvises his manner at each tier, the designer turns the intensity dial, and the ladder question gets answered by play. |
| 7 | Pre-commitment vs. responsive authoring (§6.2) | **Resolved architecturally, both halves.** Load-bearing facts are pre-committed: the era sheet, every prophecy's hidden face, every sealed decay sketch — all fixed at generation, before play, checkable after. Texture stays live. Foreclosure disclosure is now mechanical: every turn files a margin note naming what the choice killed. The §6.2 failure (authoring the page where the player walked) is structurally harder now — the storyteller cannot invent load-bearing objects, only scenes over committed facts. |
| 8 | Win adjudication | **Literal.** Prophecies are generated with two faces: the poetic face the player reads, and a hidden precise face fixed at birth. A blind Clerk — a separate AI call that knows nothing of the story, sees only the hidden condition and the committed facts, and is instructed to default to "no" — rules fulfillment. The prime prophecy's conditions are persistent once ruled true; all standing = the run is won. |
| 9–10 | The ten books; the second book | **Out of scope.** Campaign canon, untouched by the prototype. Still good mysteries. |
| 11 | Is the 50-year ceiling human-specific? | **Out of scope for the prototype; the ceiling is enforced in code for humans** (the generator's numbers are clamped, never trusted). Animals live animal lifespans (Canon 1). The in-fiction experiment remains the campaign's to run. |
| 12 | Voice mode | **Out.** The prototype is screen and text only. |

---

## 2. NEW DESIGN, DECIDED SINCE THE ORIGINAL

### 2.1 The referee/storyteller split
The app owns all state: hosts, lifespans, deaths, scars, prophecy states, committed facts, unwitnessed stretches. The storyteller AI is handed the relevant facts each turn and must return, alongside its prose, a **fact report** — who did what, where, tagged against a fixed vocabulary. The report is validated (a human host can never act in a sealed room; unknown locations are corrected) before it is committed. The storyteller never tracks anything and never rules on anything. It cannot repeat §6.1 or §6.8, because it was never given the job it kept failing at.

### 2.2 The world resolves when observed
Nothing is simulated off-screen. Jumping to Year 68 asks the storyteller to derive that moment from the permanent record. Unwitnessed time is genuinely unwitnessed — which the fiction was already claiming; now the engine agrees.

### 2.3 Scars as the single currency; unwitnessed time as byproduct
One rule, no exceptions: **rewind = one scar.** With the cap as the only loss, rewinds become a countable resource (cap 7 = roughly six rewinds a run). What a rewind overwrites is recorded as unwitnessed — the raw material of the campaign's win condition 1, manufactured by the same act Osric hunts. Knowledge survives rewinds (the lamp-attempt loop, now law); everything else un-happens. The Ledger never un-counts: unmade events stay on the page, struck through, folio numbers intact, visible in the interface.

### 2.4 Prophecies are sentences with blanks
Formal model, adopted:
- **Born with:** a poetic face (shown), a hidden precise face (checkable, fixed), roles/blanks, trigger subjects, and — loose prophecies only — a **sealed sketch**: the careless shape it takes if neglected, written at birth, readable after the run.
- **Aiming fills the blanks:** the player selects a prophecy, declares intent in their own words, names every blank. Once. Irrevocably. The storyteller is thereafter instructed, every turn, that this is fate and the world bends toward it.
- **Decay lets the world fill them:** contact warns, then locks, per the sealed sketch.
- **Fulfillment:** blanks bound, Clerk rules the hidden face literally satisfied.
- Prime conditions cannot be aimed and cannot decay — they are the door itself.

### 2.5 Each run is a complete miniature game
The prototype's era (15 years, one town) is generated fresh at run start — town, hosts, relationships, **an antagonist** (a forever-king-shaped figure in miniature: cannot be possessed, cannot be reasoned into ending, cannot be removed by force, carrying one quiet unexplained fact in the manner of the fifty-year ceiling), one prime prophecy with three conditions that end them, and N loose prophecies (dial, default 3). The setup is dealt face-up at run start, exactly as the campaign's was: the briefing names the antagonist, the prime and its conditions, and every loose prophecy's poetic face — the player begins knowing the board, as they did with Osric and the nine. Human lifespans are clamped to the ceiling in code. Two animal hosts always exist: a raven and a rat; the town's one sealed location admits only them. Comprehension traded for access, as the rat at the Ascension established.

### 2.6 Questions are thought; commands are acts
Ruled 2026-07-26, after the first live playtest found the hole: a player asked "what do I know about the drowned children" and the machine treated the asking as an act — the storyteller filed facts about the musing, and the referee, correctly enforcing decay-on-contact against bad input, brushed two prophecies. Curiosity must never cost prophecies. Now: free-text that reads as a question routes to a **recollection** — the player's own continuous mind answering strictly from knowledge and committed facts, inventing nothing, filing nothing. No facts, no contacts, no turn. And the storyteller's law was tightened: *mental acts are never facts* — recalling, wondering, noticing, deliberating leave no mark in the Ledger under any route. A designer-panel override can repair prophecies lost to bugs of this kind; the override itself is written onto the Ledger, visibly, because even the designer does not get to un-count.

### 2.7 Presentation
Pixel-art placeholders drawn in code — a closed shelf of 8 rooms and 14 figures, replaceable by real art without touching the machine. Each turn: scene art, prose, 3–4 storyteller-written choices plus a free-text box, and margin notes (foreclosures, prophecy stirs, scars). A briefing page ("The Telling Opens") orients each run: the town, its wound, the prime, the rules of the telling, the waking host. The era grid shows every host × every year — jumping is clicking. The mock mode (scripted town, no AI, zero cost) exists so the rules can be tested deterministically; it is also the tutorial.

---

## 3. HOW IT IS CURRENTLY RUNNING

- **Stack:** browser app (Vite + TypeScript), no framework, no server. Direct calls to the Claude API with the designer's key, which never leaves the machine.
- **Models:** era generation on Sonnet (quality where it matters most, once per run); scenes and Clerk rulings on Haiku (fast and a fraction of a cent). All three are dials.
- **Cost, observed:** era generation ~1–3¢; a turn well under 1¢. A session lands in pennies, as targeted. Every call is itemized in the designer panel.
- **Latency, observed:** era generation 20–45 seconds (once per run); turns 3–8 seconds.
- **Verification:** 26 automated tests pin the rules (rewind pricing, cap loss, decay tempo, aiming permanence, the ceiling, sealed rooms, the Ledger's refusal to un-count). A headless-browser script (`smoke.mjs`) drives a full mock run — possession, decay, aiming, death, dead-host re-entry, scar, rewind — with screenshots at every stage. Both pass clean as of this writing.
- **The designer panel** (backtick): scar cap, tier thresholds, Osric intensity, decay tempo, loose count, models, a reveal-hidden-faces toggle, and the full AI call log. The dials are not conveniences — they are the remaining design decisions, kept adjustable on purpose.

---

## 4. OPEN QUESTIONS — THE NEW HONEST LIST

Ranked, in the original's manner, by how much they matter.

| # | Question | Status |
|---|---|---|
| 1 | **A rewind can un-happen an aim.** Two locked rules collide: aiming is irrevocable, and a rewind un-happens everything since. As built, Option C's words win: the aim un-happens like any act, and the scar is the price. Priced, not free — but a scar now buys back aimed words. Devil's bargain or loophole? | Flagged for play. The fix, if wanted, is one line (make aim events permanent ink). |
| 2 | **Scar tuning.** Cap 7, tiers at 3 and 5, intensity 1 — defaults, not decisions. Does the hunt escalate too fast, too slow, too invisibly? | This is the prototype's central experiment. Dials. |
| 3 | **Osric's manner** (original §8.6, still open by choice). At what intensity does his attention feel like dread, and where does it tip into a cheaper villain? | Test via the intensity dial; adopt or reject the ladder afterward. |
| 4 | **Audits cluster on unmade work.** Tier 2 watches locations the player worked in *even if the work was rewound away* — the scar points at the room though the act un-happened. Thematically right (the folio that closed on nothing still names the page); possibly opaque to the player. | Watch whether playtesters read it as haunting or as a bug. |
| 5 | ~~The briefing shows the prime openly.~~ **Resolved by the designer, 2026-07-26:** the setup is dealt face-up, mirroring the original prompt — antagonist, prime, and all loose prophecies known from the start, as Osric and the nine were. | Closed. |
| 6 | **Clerk strictness.** Literal ruling against hidden faces is the anti-§6 firewall, but "poetically true, ruled no" will sting when it happens. Is strictness read as integrity or as pedantry? | Watch rulings in the designer log against felt fairness. |
| 7 | **Decay tempo.** One warning before the lock (default 2 contacts). Enough? The gradual blank-by-blank variant was considered and rejected for legibility — revisit only if warn-then-lock feels abrupt. | Dial. |
| 8 | **Dead-host re-entry anchors at the witnessed death.** Everything after the death un-happens (play-order rewind) — a simplification of the original's thread-rewrite framing. Coherent, tested, possibly not what the fiction implies at scale. | Acceptable for the prototype; re-derive before the full game. |
| 9 | **Generation trust.** The era generator writes hidden faces the player never sees. Are they actually satisfiable in fifteen years of this town? Code validates structure, not achievability. | The reveal-faces toggle exists for post-run audits. Read them. |
| 10 | **The question/command boundary is a heuristic.** Input starting with an interrogative (or ending in "?") is treated as thought; everything else as an act. Edge cases exist: "ask Merra about the vault" is an act (correct); "could I reach the vault at low tide?" is thought (correct); but a player who phrases intended actions as questions will find the world not answering with events. | Watch whether the boundary confuses players; the fix, if needed, is an explicit second button rather than a smarter guesser. |

---

## 5. STRENGTHS CARRIED OVER, NOW STRUCTURAL

The original's Section 7 asked that certain working things be protected. Their fates:

- **Foreclosure disclosure** — now mechanical, filed with every turn.
- **The lamp-attempt loop** (lose the act, keep the knowledge) — now law: knowledge is the only thing that survives a rewind besides scars and unwitnessed marks.
- **Missing pages as one pattern** — the Ledger view shows every unmade page, struck through, numbered, never erased. The player can read their own scar tissue.
- **Convergence over convenience** — load-bearing facts are pre-committed at generation; the storyteller physically cannot hand the player a convenient object it invented mid-scene, because objects it invents carry no record weight until the Referee commits them as facts.
- **The warmth mechanic and Osric not flinching** — campaign canon, not prototype systems; untouched, awaiting the real game.
