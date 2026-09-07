# Character animation sources

`final/` contains lossless runtime atlas masters. `selected/` contains selected
pose artwork used by the builder; `candidates/`, `ref-sheets/`, and `legacy/`
preserve source material and compatibility history.

Rebuild from the repository root with
`python scripts/build-character-animation-atlases.py`. Use the catalog and
builder registrations to determine active sources; fictional Nova sources do
not replace Joel's approved photo-derived character.

Optional reading for animation work:

- [Character contract](../../docs/characters/PROJECT_CONTRACT.md): twelve-frame
  geometry, frame ordering, foot registration, and collision boundaries.
- [Workflow](../../docs/characters/WORKFLOW.md): atlas and motion validation.
- [Generation history](../../docs/archive/source-assets/animation/README.md):
  selected-frame provenance, old prompts, and processing details.
- [Completed spike](../../docs/archive/docs/CHARACTER_ANIMATION_SPIKE.md):
  rationale for raster animation and rejected approaches.

Read global generation tools/cache references only when relevant to the task.
