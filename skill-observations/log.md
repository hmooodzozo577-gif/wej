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
