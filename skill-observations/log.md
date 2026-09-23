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
