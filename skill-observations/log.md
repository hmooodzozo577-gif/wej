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

### Observation 3: Check the deployment target before implementing the named technology

**Status:** OPEN
**Date:** 2026-09-09
**Session context:** A spec named Cloudflare Durable Objects, PostgreSQL via Supabase or Neon, and Redis via Upstash as the required stack for fixing a concurrency defect.
**Skill:** New skill candidate: platform-constraint-check
**Type:** open-source
**Phase/Area:** Design, before writing infrastructure code

**Issue:** The hosting manifest exposed exactly one binding, a D1 database, and no Durable Object namespace or wrangler configuration existed. Implementing the named technology alone would have produced a class that nothing could ever bind, giving the appearance of a fix while the defect stayed live in production. The requirement behind the request was a counter shared across isolates, which D1 satisfies with a single atomic upsert. Implementing a preference chain, Durable Object then D1 then a clearly-labelled per-isolate fallback, satisfied the request where the platform allows it and shipped a working fix today. A second constraint appeared in the tests: two suites load the worker as a standalone module, one through a data URL with no resolvable base, so a separate module file would have broken them and the limiter had to be inlined.

**Suggested improvement:** Create a skill for infrastructure work that requires, before writing code, reading the deployment manifest and any binding configuration to establish what the target platform actually offers, then naming the underlying capability the request depends on rather than the branded product. Where the named product is unavailable, implement the capability against what exists and keep the named product as the preferred branch behind a binding check. Include a step to check how tests load the module under change, since import style constrains file layout.

**Principle:** A named technology is a proposed means to a capability, not the capability itself. Code that targets a binding the platform does not provide is indistinguishable from no fix at all, so establishing what the deployment target offers is design input, not a detail to discover later.

### Observation 4: Validate the instrument before believing a negative result

**Status:** OPEN
**Date:** 2026-09-09
**Session context:** Investigating two reported defects, a microphone button that stops responding and dead taps in a menu, using a scripted browser harness.
**Skill:** systematic-debugging
**Type:** open-source
**Phase/Area:** Phase 1, reproduction

**Issue:** The harness produced two false failures before it produced a true one. A regular expression written to find a button by its label did not match the label's actual wording, so a working feature looked broken and was nearly "fixed". A gesture test recomputed touch coordinates from an element that moves when the app re-renders, so a working swipe-to-lock gesture also looked broken. In both cases the negative result came from the measuring tool, not the code under test. The distinguishing signal was that the failure was total rather than partial: a genuinely broken feature usually leaves traces such as an error, a changed state or a partial effect, while a mis-aimed probe produces nothing at all. Checking for a positive control, proving the harness can observe the feature working at least once, separated the two cases quickly.

**Suggested improvement:** Add a step to Phase 1 requiring a positive control before any negative result is accepted as a reproduction: demonstrate the harness observing the intended behaviour succeeding at least once in the same run, and only then treat a failure as evidence about the code. Add a corollary that a suspiciously total failure, where nothing happens at all and no state changes, should raise suspicion of the probe before suspicion of the product.

**Principle:** A negative result is a claim about the measuring apparatus until the apparatus has been shown to detect the positive case. Skipping that check turns debugging into damage: the most expensive outcome is not failing to find a bug, it is "fixing" code that was already correct.
