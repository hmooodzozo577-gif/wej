# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-09-08 — Wejhaty security hardening

### Observation 1: A denied clarifying question is a directive, not a dead end

**Date:** 2026-09-08
**Session context:** User asked, in Arabic, for "a very high security system" for a finished static travel-recommendation app. The request had four materially different readings (web hardening, code obfuscation, authentication, privacy), so AskUserQuestion was used to disambiguate. The user denied the tool call.
**Skill:** brainstorming
**Type:** open-source
**Phase/Area:** Clarifying questions / the approval HARD-GATE

**Issue:** The brainstorming skill treats "ask clarifying questions, present a design, wait for an explicit yes" as an unconditional gate. It has no guidance for the case where the user actively refuses to be asked. The denial was itself a strong signal — "stop asking, start working" — but following the skill literally would have meant asking again in another form, which would have read as not listening.

**Suggested improvement:** Add a short subsection to the skill's Process section covering refused clarification. When a user declines to answer clarifying questions, treat the refusal as delegation of the decision: pick the interpretation best supported by the repository's own constraint documents, state the chosen reading and what was excluded in one or two sentences, then proceed. Record the excluded interpretations so the user can redirect cheaply.

**Principle:** A gate exists to protect the user's intent, not to be satisfied for its own sake. When the user closes the gate from their side, honouring the intent means proceeding under a stated assumption rather than asking again.

### Observation 2: Existing project constraint docs can resolve ambiguity a user will not

**Date:** 2026-09-08
**Session context:** Same session. The repository contained a context document explicitly listing what must not be assumed — no authentication, no backend, no redesign, no external APIs. Three of the four possible readings of the request were ruled out by that document alone.
**Skill:** brainstorming
**Type:** open-source
**Phase/Area:** Explore project context

**Issue:** The skill's "explore project context" step is framed as gathering background before asking questions. In practice the context documents did more than inform the questions — they answered most of them, narrowing four readings to one before the user was asked anything.

**Suggested improvement:** In the "Understanding the idea" subsection, add: read any repository constraint or context document *before* drafting clarifying questions, and drop every question the document already answers. Ask only about what genuinely remains open.

**Principle:** Questions a repository has already answered cost the user's attention and return nothing. Reading the constraints first converts most ambiguity into a decision that can be made and stated rather than asked.

### Observation 3: Prove a guard fires by deliberately triggering it

**Date:** 2026-09-08
**Session context:** A Vite build plugin was added to fail the build if any emitted asset references an external origin. The build passed — but a build that passes proves nothing about a guard, since a guard that never runs also produces a passing build.
**Skill:** verification-before-completion
**Type:** open-source
**Phase/Area:** Evidence for a claim

**Issue:** The natural verification for a new check is "the check ran and passed". For a guard, a detector or a validator, that evidence is worthless on its own: it is equally consistent with the guard being broken, misconfigured, or scanning the wrong directory. Here, temporarily adding an external CDN URL to a source file and confirming the build failed with the intended message was what actually established the guard worked.

**Suggested improvement:** Add a rule to the skill: when the work adds something whose job is to *detect or reject* a condition, a passing run is not sufficient evidence. Verification requires deliberately introducing the condition, observing the failure, and restoring the original state. Record both the failure output and the restored passing run.

**Principle:** A guard is verified by its failures, not its successes. Absence of an alarm proves nothing until you have shown the alarm can ring.

### Observation 4: Security work on a static site needs its scope stated before it starts

**Date:** 2026-09-08
**Session context:** The app has no backend, no accounts, no stored user data and no secrets. Establishing that first turned a vague request into a short, concrete list of real threats: hostile markup execution, clickjacking, and third-party tracking.
**Skill:** New skill candidate: static-site-hardening
**Type:** open-source
**Phase/Area:** Whole workflow

**Issue:** "Add strong security" is a common request with no fixed meaning. For a static client-only site most conventional security advice (authentication, input validation, rate limiting, secret management) does not apply at all, while the measures that do apply are specific and finite: eliminate third-party origins, deny-by-default CSP, guard every HTML-injection sink, harden the build and deploy pipeline, and document which protections the host cannot enforce.

**Suggested improvement:** Create a skill that starts by inventorying what the app actually is (backend, data, auth, secrets, third-party origins, injection sinks), derives the applicable threat list from that inventory, and then works a fixed checklist. It should require that host limitations be written down rather than silently accepted, and that every control be proven by a negative test.

**Principle:** Security work is scoped by the architecture, not by the strength of the adjective in the request. Inventory first; the threat list follows from what exists, and controls that address nothing are cost without benefit.
