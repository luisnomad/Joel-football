# Working on Joel Football

## Ownership and quality

- Take full ownership of assigned tasks from investigation through implementation,
  verification, and a concrete handoff. Treat action requests as mandates to
  execute; do not stop at opinions, feasibility confirmation, or offers to help.
- Treat this as a commercial product for paying customers, not a hobby project.
  Deliver production-quality behavior, usability, reliability, and maintainability.
- Cutting corners is unacceptable. Before reducing scope, skipping required
  validation, or accepting a quality compromise, propose the shortcut with clear
  pros, cons, and risks and obtain explicit user approval. Never silently weaken
  checks or claim incomplete work is done.
- Be creative and explore feasible alternatives. Investigate trade-offs before
  rejecting an idea. Preserve unrelated user changes and existing approvals;
  ask only for missing decisions or authorization genuinely needed to proceed.
- Verify the affected behavior and inspect visual changes in game. Report what
  changed, checks performed, and any unresolved limitations. Historical passes
  never substitute for evidence on the current change.

## Working conventions

- Before shell work, read and follow the machine's
  [RTK.md](/Volumes/SSD_Storage2TB/Users/luisnomad/.codex/RTK.md); prefix shell
  commands with `rtk` (use `rtk proxy` for unsupported commands).
- Start with the relevant code and [README](README.md). Keep English/Spanish
  behavior consistent, preserve saved profiles, and protect tablet quality.
- Keep this file short. Put conditional guidance under `docs/`, link it with a
  task trigger, and move completed records or rejected directions to
  `docs/archive/`. Preserve useful context and repair links when moving files.

## Optional reading — only for the immediate task

- [Documentation index](docs/README.md): select a product or workflow reference.
- [Development](docs/DEVELOPMENT.md): architecture, AI providers, audio.
- [Responsive layout](docs/RESPONSIVE_LAYOUT_GUIDE.md): UI, scenes, scaling, art geometry.
- [Character workflow](docs/characters/WORKFLOW.md) and
  [skill](.agents/skills/create-game-character/SKILL.md): character work.
- [Sprite pipeline](docs/SPRITE_PIPELINE.md) and [skill](.agents/skills/sprite-pipeline/SKILL.md): video-generated animation frames.
- [Android](docs/ANDROID.md) and [release checklist](docs/PLAY_STORE_RELEASE_CHECKLIST.md): native/release work.
- [Web publishing](docs/WEB_PUBLISHING.md): authorized website publication.
- [Open work](docs/OPEN_WORK.md): pending work; [archive](docs/archive/README.md): historical investigation only.

Read external/global links and skills only when relevant to the immediate task;
RTK is relevant before shell work. Do not bulk-load linked docs or the archive.
Optional reading controls when to load context, not whether applicable quality
and acceptance requirements must be satisfied.
