# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-09-09

## 2026-09-23

### Observation 1: Decorative-motion QA must verify full visible route, not just displacement
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** Frontend acceptance repair of decorative airplane animations (CSS offset-path) on a travel web app.
**Skill:** playwright-skill (also impeccable `animate`)
**Type:** open-source
**Phase/Area:** Motion verification / browser QA

**Issue:** A previous round verified planes by measuring displacement at t0/t+2s/t+4s ("moves 33–175px per 2s") and declared them fixed. The user rejected it: several planes faded in mid-band (opacity keyframes + a mask on the band's inner edge), so to a human they appeared to spawn halfway, travel part of the route and vanish. Displacement sampling cannot detect partial visible traversal.

**Suggested improvement:** In the motion-QA guidance, add a "visible-route" check: sample the animated element at many points across one full cycle (e.g., 20 samples), record effective visibility (opacity chain, mask, clipping by overflow ancestors) at each, and assert the element is visible from its entry edge to its exit edge — or explicitly off-screen at both ends. Forbid opacity/mask fades that hide the element inside the visible region.

**Principle:** Verify what the user perceives, not a proxy metric. For motion, "it moves" ≠ "it travels the whole path visibly"; test the perceptual claim directly across the full cycle.

### Observation 2: RTL numbers after Arabic text flip their percent sign — isolate them
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** Adding a labelled "general suitability: 63%" line beside a score ring in an Arabic-first travel UI.
**Skill:** impeccable (`harden` / i18n guidance)
**Type:** open-source
**Phase/Area:** RTL typography / bidi

**Issue:** "…(سياحة وإجازة): 63%" rendered as "%63" while the ring and pills beside it rendered "63%". Unicode bidi rule W2 turns European digits that follow Arabic letters into Arabic numbers, so the percent sign no longer binds to the number and resolves right-to-left. Numbers at the start of a string (the pills) were unaffected, which made the inconsistency easy to miss in code review; only a zoomed screenshot showed it.

**Suggested improvement:** In RTL/i18n hardening checklists, add: "a number with a unit or sign (%, /100, currency) that follows Arabic text must be direction-isolated (`<bdi>` or `dir="ltr"` on its element) so it matches numbers shown elsewhere; verify with a zoomed screenshot, not the DOM string."

**Principle:** Bidi correctness is visual, not textual — the DOM string is right while the rendering is wrong. Check the rendering.

### Observation 3: Detector contrast findings on translucent gradients need computed-color confirmation
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** Running the impeccable detector against a light-theme results card whose background is a solid colour plus a low-alpha radial gradient ending in `rgba(0,0,0,0)`.
**Skill:** impeccable (`audit`)
**Type:** open-source
**Phase/Area:** Automated design audit triage

**Issue:** The detector reported ink headings and body text at 1.3–1.7:1 "via analytic-gradient+alpha". Computed styles showed ink `#17243a` on `#fffdf8` (~15:1); the transparent-black gradient stop appears to be composited as black. Acting on the finding would have damaged a correct design.

**Suggested improvement:** In the audit playbook's "verify each finding in context" step, name this case: for `analytic-gradient+alpha` contrast findings, read `background-color` and `background-image` of the ancestor chain (or sample rendered pixels) before accepting; also baseline the same URL without the feature under review to separate pre-existing findings from new ones.

**Principle:** Triage automated findings against ground truth and against a baseline; report which findings the change introduced.

### Observation 4: Scripted stylesheet edits must anchor on whole lines, then prove placement
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** Adding a new rule block to a large shared stylesheet with a scripted find-and-insert (first occurrence of a selector string).
**Skill:** New skill candidate: safe scripted source edits (also relevant to impeccable's craft floor for CSS changes)
**Type:** open-source
**Phase/Area:** Implementation mechanics / CSS

**Issue:** The anchor `.hero-continue-link {` also matched inside a longer, indented selector (`.home-hero-frame .hero-continue-link {`) within a container query, so the new block was spliced into the middle of that selector. CSS parsing tolerated it: the build, type-check and lint all passed, while two rules were silently corrupted (one selector gained a stray prefix, another escaped its container query). Only a structural test that sliced the container block and asserted its contents exposed it.

**Suggested improvement:** When editing CSS (or any brace-structured source) by script: anchor on a full line including the leading newline and indentation, assert the anchor occurs exactly once, and after the edit verify placement structurally (e.g. the enclosing block's extent, or the rule's top-level position) rather than trusting a green build.

**Principle:** A tolerant parser turns a mis-anchored edit into a silent regression. Uniqueness plus structural post-checks are cheap insurance; build success is not evidence of correct placement.

### Observation 5: Privacy/leak checks in browser tests must match the data's meaning, not a keyword
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** A read-only production smoke test asserting that a session-only passport country is never sent over the network, plus lab performance runs on a heavy page.
**Skill:** playwright-skill (browser QA scripts); relevant to any skill that writes verification scripts
**Type:** open-source
**Phase/Area:** Verification scripts

**Issue:** The first leak check flagged any request body containing the word "passport". An anonymous analytics event legitimately named `quiz_passport_choice` with `{ chosen: true }` tripped it — a false positive that could have prompted removing a harmless event, while a real leak under another field name would have passed. Separately, a performance script read First Contentful Paint a fixed 2.5 s after `load`; on a throttled heavy page FCP came later, so the metric silently recorded 0.

**Suggested improvement:** In verification scripts, express a privacy assertion as the sensitive value or field shape (e.g. a passport/nationality key with a string value, or the chosen country's code) rather than a substring, and list the known-benign events it must allow. For lab metrics, wait until the metric entry exists (with a timeout) instead of a fixed delay, and treat a missing value as a failed measurement, never as 0.

**Principle:** A check that matches on vocabulary rather than meaning produces both false alarms and blind spots; a missing measurement must never be recorded as a result.

### Observation 6: Reverting an experiment must not revert unrelated uncommitted work in the same file
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** A performance experiment (rendering flags as images) touched two component files that already carried uncommitted, unrelated edits (a heading-level change). The experiment was reverted with a whole-file checkout.
**Skill:** New skill candidate: safe scripted source edits (same candidate as Observation 4); relevant to any workflow that runs throwaway experiments in a dirty working tree
**Type:** open-source
**Phase/Area:** Implementation mechanics / version control

**Issue:** The whole-file checkout restored the committed version and silently dropped the earlier uncommitted heading change in one of the files. It was noticed and restored by hand; the test suite did not cover that element's tag, so it would not have caught the loss.

**Suggested improvement:** Before starting an experiment in a dirty tree, save it as its own patch (or commit/stash the unrelated work first), and revert the experiment by reversing that patch, never by checking out whole files. After any revert, diff the file against the intended state.

**Principle:** A revert should undo exactly one change. Whole-file restores in a dirty tree undo everything, and green tests are no proof that nothing else was lost.

### Observation 7: Markup-level changes guarded by computed styles, not pixel diffs, when the page has live imagery
**Status:** OPEN

**Date:** 2026-09-23
**Session context:** Promoting section headings from h3 to h2 for a correct heading order, with the requirement of no visual change.
**Skill:** impeccable (audit/harden: accessibility fixes that must not change the design); playwright-skill (verification scripts)
**Type:** open-source
**Phase/Area:** Accessibility / verification

**Issue:** Element-type selectors (`.card h3`) stopped matching after the tag change; the fix was `:is(h2, h3)` (same specificity), plus `:where(:not(...))` to keep one unrelated h2 from matching a broadened rule. Screenshot diffs on pages with remote images differed even between two runs of the same build, so they could not prove "no visual change".

**Suggested improvement:** For tag-level accessibility fixes, extend selectors with `:is()` to preserve specificity, and prove visual neutrality by comparing computed styles and box geometry of the affected elements between the old and new build; use pixel diffs only on pages without nondeterministic imagery, after a same-build noise baseline.

**Principle:** Establish the noise floor of a visual check before trusting it; when it is noisy, compare the properties that the change can actually affect.

### Observation 8: A "must not write production data" guard has to run, and be proven, before the first page load
**Status:** OPEN

**Date:** 2026-09-24
**Session context:** Real-browser release smoke tests (desktop Safari, iOS Simulator, VoiceOver) on hosted macOS runners against the live site, with the analytics backend blocked through `/etc/hosts`.
**Skill:** playwright-skill (and any production smoke / browser-automation workflow)
**Type:** open-source
**Phase/Area:** Production verification / data hygiene

**Issue:** Only the IPv4 name was mapped, so the backend stayed reachable over IPv6, and the in-page guard ran after the site had already loaded. A few runs wrote anonymous analytics events to production before the guard reported the leak.

**Suggested improvement:** Block every address family (IPv4 and IPv6), flush the resolver cache, then prove the block from the shell (a request that must fail) and again from inside the browser on a blank page — all before opening the site. Treat a successful probe as a hard stop. Retry flaky environment setup (simulator registration, UI-automation prerequisites) with a small bounded loop, but never retry an assertion.

**Principle:** A safety guard that runs after the risky action is a report, not a guard. Prove the protective state first, then act.

### Observation 9: Test analytics SQL against the real schema, and run dashboard QA against the real runtime with synthetic data
**Status:** OPEN

**Date:** 2026-09-24
**Session context:** Rebuilding an admin analytics dashboard (funnel semantics, drop-off, distinct-session counts) on Cloudflare D1.
**Skill:** New skill candidate: analytics-dashboard verification (metric dictionary + real-schema SQL tests + local-runtime QA)
**Type:** open-source
**Phase/Area:** Testing / data correctness

**Issue:** The existing tests used a fake database that only recorded SQL text, so they could prove what a query asked for but not what it answered; a hand-written JSON stub drove the visual QA. Neither could catch a wrong denominator or a label that counted events while saying sessions (both existed).

**Suggested improvement:** Apply every migration to an in-memory SQLite (Node's built-in `node:sqlite`) and assert metric values for named journeys; keep one metric dictionary (definition, numerator, denominator, window, limitation) as the single source for labels, docs and tests; run browser QA against the real runtime in local mode (`wrangler dev --local`) over a deterministic synthetic seed. Keep a guard on per-request query count when the platform caps it.

**Principle:** A metric is only defined once it has a numerator, a denominator and a window written down — and it is only tested once a real query engine has computed it.

### Observation 10: Reproduce hosting blank screens by matching built asset hashes to the host's log

**Status:** OPEN
**Date:** 2026-10-09
**Session context:** Static SPA blank on a second static host after a successful build.
**Skill:** systematic-debugging
**Type:** open-source
**Phase/Area:** Evidence gathering / reproduction

**Issue:** Live site unreachable from sandbox. Rebuilding locally with the host's (empty) env reproduced the exact asset hashes from the host's build log, proving the same output; serving it from the root with a 404-fallback server plus a headless browser showed the asset 404 and empty root.

**Suggested improvement:** Add to reproduction guidance: when the live target is unreachable, match content-hashed filenames from the deploy log to a local build to prove output equivalence, then emulate the host's serving rules locally.

**Principle:** Content hashes turn a build log into a reproducibility oracle when live access is blocked.

### Observation 11: jsdom cannot see browser focus steps — verify modal focus restore in a real browser

**Status:** OPEN
**Date:** 2026-10-10
**Session context:** Adding an accessible modal dialog to a React app with unit tests in jsdom.
**Skill:** test-driven-development (and web-design-guidelines for dialog reviews)
**Type:** open-source
**Phase/Area:** Verification of focus management

**Issue:** Unit tests asserted that focus returned to the trigger after a backdrop close, and that Tab stayed trapped. Both passed in jsdom while the real browser put focus on <body> (the browser's own mousedown focus step runs after React restores focus), and the Tab assertions passed even with the trap code deleted (fireEvent does not move focus). An adversarial reviewer found both by driving real Chromium and by deleting the code under test.

**Suggested improvement:** For dialogs and focus traps: assert the handler's effect (event defaultPrevented via fireEvent's return value, focus moved by the handler), run a mutation check (delete the trap, the test must fail), and confirm backdrop/Escape/close focus restore in a real browser for mouse and touch.

**Principle:** A test that passes with the feature deleted proves nothing; for browser-owned behaviour (focus, default actions) jsdom is not evidence.

### Observation 12: Integrate supplied brand artwork by adapting, not copying, and pin it with a shape-for-shape test

**Status:** OPEN
**Date:** 2026-10-10
**Session context:** Integrating an approved logo package (SVG masters + a generated React component + icons) into an existing typed React app.
**Skill:** impeccable (asset integration) / New skill candidate: brand-asset-integration
**Type:** open-source
**Phase/Area:** Asset audit and integration

**Issue:** The supplied component was untyped and bundled every variant; copying it in would have added dead variants and an untyped module. Adapting it (typed, only the used variants, colours as CSS custom properties so a theme can switch to the on-dark cut) plus a test that compares each rendered shape to the master SVG kept fidelity provable. The existing icon generator would have silently overwritten the approved icons on its next run; it had to be changed to copy, not redraw.

**Suggested improvement:** Checklist for supplied brand assets: scan SVGs for active content; diff colour variants (often colour-only, so one inline SVG + CSS variables covers them); keep only used files as masters in the repo; test rendered artwork against masters and served icons byte-for-byte; find every generator that writes the same public paths.

**Principle:** Approved artwork must be provably identical to its source, and every tool that writes the same files must be brought in line or it will undo the integration.
