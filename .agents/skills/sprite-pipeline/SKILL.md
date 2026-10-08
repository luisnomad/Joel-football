---
name: sprite-pipeline
description: Re-author Joel Football character animation frames with the Kick or Treat video-to-sprite pipeline (GPT Image 2.5 reference, Minimax H3 clips, Qwen 2.1 key poses, TostAI matting, locked-palette snap, 4x3 atlas packing).
---

# Sprite Pipeline

Rebuild a roster character's runtime frames from generated animation while
keeping the 4×3 320×480 atlas contract. Follow the repository's
[AGENTS.md](../../../AGENTS.md) and, for identity, privacy, and integration, the
[create-game-character skill](../create-game-character/SKILL.md).

1. Read [the pipeline guide](../../../docs/SPRITE_PIPELINE.md) §2 (current system)
   and §10 (migration plan, open owner decisions). Do not generate until the
   decisions that block the task (privacy/cloud use, style, width budget) are
   answered.
2. Quote before every paid Dreamina run and report the credits. Use ATOM GPU time
   only when Maestro and Studio are up; stop the owner's LLM services only with
   permission for that occasion.
3. Start from the approved identity anchor, never private photos. Stop for
   owner/guardian approval of the side-view reference before making clips.
4. Run `tools/sprite-pipeline/` scripts with the Kick or Treat venv python. Work in
   `source-assets/sprite-pipeline/` and stage atlases there. Install into
   `source-assets/animation/final/` and `public/assets/` only after approval, with
   new version suffixes.
5. Complete the guide's QA checklist, the character audits, and the in-game
   gate. Remove obsolete `frameScales` and re-measure `kickReach` for rebuilt
   characters.

## Optional reading — select by immediate task

- [Pipeline guide](../../../docs/SPRITE_PIPELINE.md): services, script usage,
  prompts, gotchas, QA, and migration plan.
- [Tooling](../../../tools/sprite-pipeline/): `config.py` documents path overrides;
  `examples/plans/` has queue, plan, and atlas formats.
- [Project contract](../../../docs/characters/PROJECT_CONTRACT.md): atlas geometry
  and catalog fields.

Do not run generation for verification; `--help` and `pack_atlas.py` on existing
sheets cost nothing.
