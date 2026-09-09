# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-09-09

### Observation 1: Establish a verified baseline before touching an uploaded archive

**Status:** OPEN
**Date:** 2026-09-09
**Session context:** User uploaded a zip containing an iOS wrapper project plus its web source and asked to unzip and "set it up", with no error report attached.
**Skill:** New skill candidate: archive-intake
**Type:** open-source
**Phase/Area:** Intake of user-supplied archives

**Issue:** "Set it up" with no stated defect is ambiguous, and the tempting move is to start editing files that may already be correct. Running the project's own integrity checks and test suites first turned an open-ended request into a factual baseline: checksums matched, the build was byte-reproducible, and four test suites passed. A structural validator written for the project format then showed zero errors, which meant the correct action was to change almost nothing rather than to "fix" working code.

**Suggested improvement:** Create a skill covering archive intake: extract to a scratch location outside the repo, verify any shipped checksum manifest, scan for secrets and oversized files before any commit, run the project's own build and tests to record a pass/fail baseline, and only then decide what needs changing. Include an explicit rule that a clean baseline is a result worth reporting, not a reason to invent work.

**Principle:** When a request names no specific defect, the first deliverable is evidence about the current state, not a change. Verification before modification prevents churn on code that already works, and separating "verified here" from "could not be verified in this environment" keeps the report honest.
