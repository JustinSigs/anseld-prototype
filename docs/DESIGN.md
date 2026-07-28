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

### 2.7 The affordance systems (ruled 2026-07-26, after the Sessmere post-mortem)

The designer defined engagement precisely: *figuring out how to enact the prophecy; manipulating events in the past to affect the future; inhabiting people and creatures; seeing the outputs of your actions ripple throughout time.* Every one requires a world solid enough to scheme against. Four systems deliver it:

**Decay redefined — decay follows from what the player did, enforced three ways.** Contacts count only on player-initiated turns (never wakings or arrivals — the Sessmere log showed all three loose prophecies warned by the opening scene, before any input); only from facts whose actor is the worn host (the storyteller's own drama — the bell it rang unprompted — can never burn a prophecy); and at most once per prophecy per in-world year (tempo runs on the calendar: "left too long" now means *time*, as the original threat always implied). The generator is additionally forbidden from letting loose prophecies share tags — Sessmere put "causeway" on all three, guaranteeing carnage.

**Sealed facts — mysteries are born with answers.** The generator fixes 2–4 era truths at birth; the storyteller, whenever a scene introduces a mystery or unexplained deliberate act, must file the hidden truth then and there (who, why, who knows). Sealed facts are permanent ink — rewinds do not unmake truth — and are fed to the storyteller every turn, so witnesses keep secrets like people instead of like vacancies. "Who cut the rope" now has an answer the moment the rope appears cut.

**Host memory — knowledge is the player's; while worn, the body's secrets are readable.** Sealed facts carry attribution, and entering a host permanently converts what that body knows into the player's knowledge. Possession is now the investigative instrument it was in the campaign.

**Ripples and settling — the wake is not free, and you SEE it.** Exiting a host opens a ripple (visible in a Ripple Ledger panel, in the campaign's R1/R2 manner); scenes can open more. A forward time-jump settles the gap before arrival: one AI call reckons what the unobserved years did with every open thread — committed as facts, closed ripples announced, and a chronicle the player reads. Settled facts never brush prophecies (the world resolving itself is not the player acting).

**Possession by description — be anyone.** A described body ("the raker nearest the chapel at noon, Year 63") resolves to an existing host or instantiates a new one, permanently, referee-validated (the ceiling is clamped in code, here too). Restores the Corvin Halloway move. Governed by **the Oracle Rule**: a description resolvable only by revealing a sealed truth the player has not learned ("whoever cut the rope") is refused — flesh is found by what you know, and mysteries are solved by play, not by teleport.

### 2.8 Presentation
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
| 7 | ~~Decay tempo — confirmed too fast in first live playtests.~~ **Resolved 2026-07-26 by the decay redefinition (§2.7):** player-initiated turns only, host-actor facts only, once per prophecy per year, no shared tags between loose prophecies. The Sessmere log (all three prophecies warned by the opening scene; one decayed by asking a man about a rope twice; two more by the storyteller's own bell) was the deciding evidence. Remaining: tune contacts-to-decay against the new, slower clock. | Closed as designed; tempo dial still open. |
| 8 | **Dead-host re-entry anchors at the witnessed death.** Everything after the death un-happens (play-order rewind) — a simplification of the original's thread-rewrite framing. Coherent, tested, possibly not what the fiction implies at scale. | Acceptable for the prototype; re-derive before the full game. |
| 9 | **Generation trust.** The era generator writes hidden faces the player never sees. Are they actually satisfiable in fifteen years of this town? Code validates structure, not achievability. | The reveal-faces toggle exists for post-run audits. Read them. |
| 10 | **Settling quality is unproven.** The settle call decides what unobserved years did with open threads — soberly, per its instructions, but it is the one place live authorship re-entered the machine. Watch whether chronicles feel like consequence or like weather; watch cost (one call per forward jump). | New, from the affordance build. |
| 11 | **On-demand hosts can bloat the roster.** Every described stranger becomes permanently real. A player who describes freely could triple the cast; the grid grows, the storyteller's context grows. | Watch; a cap or a "minor person" tier are the candidate fixes. |
| 12 | **The question/command boundary is a heuristic.** Input starting with an interrogative (or ending in "?") is treated as thought; everything else as an act. Edge cases exist: "ask Merra about the vault" is an act (correct); "could I reach the vault at low tide?" is thought (correct); but a player who phrases intended actions as questions will find the world not answering with events. | Watch whether the boundary confuses players; the fix, if needed, is an explicit second button rather than a smarter guesser. |

---

## 5. STRENGTHS CARRIED OVER, NOW STRUCTURAL

The original's Section 7 asked that certain working things be protected. Their fates:

- **Foreclosure disclosure** — now mechanical, filed with every turn.
- **The lamp-attempt loop** (lose the act, keep the knowledge) — now law: knowledge is the only thing that survives a rewind besides scars and unwitnessed marks.
- **Missing pages as one pattern** — the Ledger view shows every unmade page, struck through, numbered, never erased. The player can read their own scar tissue.
- **Convergence over convenience** — load-bearing facts are pre-committed at generation; the storyteller physically cannot hand the player a convenient object it invented mid-scene, because objects it invents carry no record weight until the Referee commits them as facts.
- **The warmth mechanic and Osric not flinching** — campaign canon, not prototype systems; untouched, awaiting the real game.

---

## 6. MOVEMENT LOG

A running, dated record of what was decided, built, and learned. Append-only, in the Ledger's spirit. Every working session adds its entries.

### 2026-07-26 — design finalized, prototype built, first playtests
- **Decided:** all twelve of the original §8 items ruled (see §1); code referees / AI narrates; scars as single currency; scar cap as only loss; prophecies as sentences-with-blanks with two faces; per-run generation; face-up setup mirroring the original prompt.
- **Built:** full prototype at `C:\Dev\anseld-prototype` — Record/Referee core, mock + live modes, pixel placeholder art, era grid, briefing, designer dial panel, save/resume. 26→37 automated tests across the day.
- **Learned (playtest 1, Sessmere):** asking yourself a question was treated as a world-act and burned two prophecies → ruled *questions are thought, commands are acts*; recollection mode built; designer prophecy-repair override added (visible on the Ledger).
- **Learned (Sessmere log post-mortem):** all three loose prophecies were warned by the opening scene, before any input — the generator had put "causeway" on all three, the arrival directive seats the player at the wound, and the storyteller's own invented drama (the bell) decayed prophecies. Root cause: incidental and meaningful contact were the same thing.
- **Decided (engagement definition, verbatim intent):** figuring out how to enact the prophecy; manipulating the past to affect the future; inhabiting people and creatures; seeing outputs ripple through time. Bar: fair machine — drama pre-committed, then discovered.
- **Built (affordance systems):** decay redefined (player-initiated, host-actor, once per prophecy per year, no shared loose tags); sealed facts — mysteries born with answers, permanent ink, knownTo attribution; host memory on possession; ripples + settling on forward jumps with a visible Ripple Ledger; possession by description with on-demand host instantiation and the Oracle Rule.
- **Watching:** settling quality vs cost (open question 10); roster bloat from described hosts (11); question/command heuristic (12); rewind-can-unaim-an-aim (1); scar tier tuning — the dials' whole purpose (2, 3).

### 2026-07-26 (later) — shared
- **Deployed:** public repository `github.com/JustinSigs/anseld-prototype`; playable build at `https://justinsigs.github.io/anseld-prototype/`. Mock mode is free for anyone; live runs require the player's own API key, pasted on the start screen and stored only in their browser. Redeploy: `npm run build:pages`, copy `dist` onto the `gh-pages` branch, push.

### 2026-07-27 — the fun verdict, and the riff sessions
- **Playtest verdict (designer):** "this isn't very fun" — language obtuse without context, prophecies read as made up. Diagnosis accepted: prophecies reference a history that never happened (one-shot generation has nothing underneath it), and the cold-ledger voice was imported without the 11 sessions of context that earned it.
- **Direction on the table (not yet ruled):** history-first generation (Dwarf-Fortress move: chronicle of dated, causally-chained events first; prophecies must cite the events they grow from; browsable Chronicle panel); the historical diff (change the past, watch Chronicle entries strike through and rewrite — the centerpiece payoff of time manipulation); plain-language pass with a tone dial.
- **Riff sessions (Fable / Stardew / RimWorld):** recurring thesis — *algorithms react to flags; AI reacts to meaning.* Candidate mechanics that bolt onto existing machinery: belief-as-a-layer (rumor ledger beside the fact Ledger, gossip that mutates, seeding rumors as a verb); testimony from knowledge+motive with mechanically catchable lies; readable artifacts with agendas; the town forming folklore about the player's existence; NPC wants/fears/secrets pursued during settling; fairness stays code-owned always. Emerging claim: the prototype's architecture (committed record, sealed truths, meaning-reactions, resolution-at-attention) is a general engine — ANSELD is its most hostile configuration.

### 2026-07-27 (later) — the crux, and Prototype 2
- **The crux, named by the designer:** "be anyone to solve something" is a macro-loop with no moment-to-moment game under it. Fable/RimWorld's second-to-second fun = a world visibly in motion with the player present in it. Text turns cannot supply this at any prose quality.
- **Ruled:** pivot approved; original text prototype preserved (deployed, linked); real-time with pause; slice 1 is movement + clockwork only — prophecies, scars, settling, sealed truths reattach in slice 2 once the moment-to-moment is proven fun.
- **Built (Prototype 2 — The Clockwork Town, `town.html`):** walkable Saltmere (44×30 grid); real-time clock (1s = 6 game-min; pause/1x/2x/4x; day/night tint); eight inhabitants walking daily schedules via BFS pathing (pure code, zero AI); possession as embodiment (adjacent + E; the left body resumes its day unsteered); species as collision (flue tiles admit rats, water admits ravens, the undervault has no door); talk and overhear at the point of attention (mock canned / live Haiku); Kenney CC0 roguelike art. 47 automated tests; browser smoke clean; deployed alongside the original at /anseld-prototype/town.html.
- **Acceptance question for the designer:** is watching + walking + possessing fun for five minutes with no story at all? Slice 2 (reattach the strategy layer, history-first chronicle, belief/testimony systems) waits on that verdict.

### 2026-07-28 — clockwork verdict: intriguing, not yet fun
- **Designer verdict on Prototype 2 slice 1:** "intriguing, wouldn't say fun yet — the characters just walk around." Talk-reliability bugs fixed same day (reach rules, walkers waiting, panels holding the world).
- **Diagnosis:** the clockwork is legible but inconsequential — schedules never vary, agents never interact, nothing reacts when poked, and nothing is at stake in learning the patterns. Watching is only fun when the watcher needs the patterns or the simulation pushes back.

### 2026-07-28 (later) — Prototype 3: Gullshead Island
- **Designer pitch (superseding the Saltmere mystery slice):** an island tourist town, run down, reached by ferry. Player is the mayor: build attractions to satisfy tourist wants (food, fun, history, rest) and manage the island's secret — it is cursed at night. Tourists who witness the supernatural spread bad word on the mainland; arrivals and money fall. The nightly verb: investigate, prevent, or distract. Rulings: own setting (not Anseld), walk-the-island embodiment, quirky-funny tone (ghosts eerie, reactions comic), tight 10-day-season first version.
- **Built (`island.html`, `src/island/`):** Gullshead — four repairable lots mapped to wants; six locals with voice bibles; generated tourists with wants and tempers; treasury/satisfaction/reputation loop where reviews (the Mainland Gazette) drive next-day arrivals; three night visitations with learnable rules (Walker every third night; Choir on fog; Weeping House otherwise) and two prevention levers (salt line, chapel bell before nine); bonfire distraction; curse journal pages for the mayor who watches up close; end-of-season report; ferry stops if reputation collapses. Mock mode free; live mode adds AI voices under the tone contract. 62 tests; full day-night-day browser smoke clean; deployed as third prototype alongside the other two.
- **Design observation from the smoke run:** day-one visitors are doomed to bad reviews (nothing can be built before they leave) — the season opens with a guaranteed reputation dip. Tune or embrace — designer's call after play.

### 2026-07-28 (later still) — ferry gating
- **Ruled and shipped:** no tourists arrive until at least one lot is open — Captain Ferrick refuses to "ferry people to a rumor." No reputation decay while the island is closed (the mainland can't review what it never saw). Kills the doomed-day-one problem; the season now opens with a building beat, then the first ferry is an earned event.

### 2026-07-28 (evening) — get-it-running notes from the designer, shipped same session
- Notice board is now a physical object in the square (post, plank, civic paperwork, the mayor's official pin).
- Repair works at the building itself: stand at any boarded door and E offers "Repair (cost)" — the board remains for bonfires/salt/overview.
- Buildings are visually distinct: per-building wall/floor tints, striped lighthouse, and a shingle over each door (🛏 🍲 🎶 🏛 📜).
- Everyone has a home: four cottages added; locals' schedules end at their own doors; windows glow warm after dark (homes and civic buildings always; repaired lots too; ruins stay dark — which is exactly where the Weeping House likes it).

### 2026-07-28 (night) — the mayor's day
- **Designer question: "what should the mayor be doing while the day is occurring?"** Answer shipped as a day rhythm of appointments, errands, and preparation:
  - **Greet the ferry (9:00 appointment):** stand at the pier as visitors land — they tell you what they came for, start warmer, and rate the stay higher. Reviews mention it ("The mayor met the boat personally. Small thing. It isn't, though.").
  - **Point them somewhere:** direct any tourist to an open attraction or the beach; a match delights (bonus + coin), a mismatch goes in the review ("Confident about it, too.").
  - **Forecasts from the locals:** ask Ferrick about the weather (smells fog = choir nights), Edda about the lane (keeps the walker's calendar), Maren about anything (knows, tells you the lever). Afternoon talk is now night-planning reconnaissance.
  - **One odd job a day:** kegs, cart wheel, Edda's cat (found at the chapel, staring at the bell — jobs carry lore). Coin rewards.
  - **Daytime clue spots:** the scoured lane stones, the chapel's oiled bell with six names scratched in its lip, and the repaired Museum's back cabinet ("NOT FOR SEASON") — day pages join the curse journal; the money-building quietly advances the mystery.
- 66 tests; smoke clean; deployed.
