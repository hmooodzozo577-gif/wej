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

### Observation 2: Measure the named symptom before optimising the suspected cause

**Status:** OPEN
**Date:** 2026-09-09
**Session context:** A spec demanded a "zero-lag" app. The obvious culprit was a full innerHTML rebuild on every interaction, and the obvious fix was to batch renders behind requestAnimationFrame.
**Skill:** systematic-debugging
**Type:** open-source
**Phase/Area:** Diagnosis before remediation, performance work

**Issue:** Both the obvious culprit and the obvious fix were wrong. Driving the real app in a throttled browser showed navigation cost 2.6 ms and missed zero frames, so the rebuild was not the problem. The cost sat in one line that read scrollTop immediately after writing innerHTML, forcing a synchronous layout inside the event handler. Moving that single read to the next frame cut per-interaction blocking from 11.3 ms to 5.1 ms. Separately, the planned batching fix would have broken more than thirty assertions in the project's own test suite, because those tests call a navigation function and then read innerHTML, which silently encodes a requirement that rendering stay synchronous.

**Suggested improvement:** Add a rule to systematic-debugging that performance work starts by reproducing and measuring the user-visible symptom on the specific path named in the complaint, with results recorded before and after on the same machine in the same session. Add a second rule: before any refactor, read the existing tests to find behavioural contracts they encode implicitly, and treat a change that would require editing tests as a signal to find a different change.

**Principle:** A plausible cause is not a measured cause, and the cheapest correct fix is often one line rather than an architectural change. Existing tests are a specification of behaviour the codebase has already promised; needing to edit them to accommodate a refactor is evidence against the refactor, not an obstacle to route around.
