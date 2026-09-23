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
