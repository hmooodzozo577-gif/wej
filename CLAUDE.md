# CLAUDE.md

## Skill activation

At the start of any task-oriented session — any interaction where you will use tools and produce deliverables — invoke the task-observer skill before beginning work.

## Skill usage policy

For substantial tasks, evaluate available project-local skills before implementation. Use relevant skills when they materially improve correctness or quality.

For specialized work such as UI/UX, frontend design, browser testing, visual QA, accessibility, React performance, debugging, security, API work, architecture, testing, or deployment, first consider existing skills under `.claude/skills/`. If an important capability appears to be missing, use the project-local `find-skill` skill to search for a suitable skill. Do NOT add or install a new third-party skill automatically unless the user's request explicitly authorizes it. Do not use `find-skill` for trivial tasks where specialized capabilities would not materially help.

In substantial final reports, state which skills were actually used and their purpose.
