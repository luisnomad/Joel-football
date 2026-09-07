# Documentation audit — 2026-09-07

Completed structural audit. Optional reading for this cleanup's scope and
classification. External/global references are relevant only to an immediate
follow-up question; this audit did not revalidate online policy or account state.

## Scope and decisions

- Inspected all 34 tracked Markdown/agent-YAML documents, repository skill
  resources and auditor callers, and the available documentation inventory.
  No root AGENTS.md existed; added a concise one with ownership, production
  quality, explicit approval for shortcuts, shell rules, and optional routing.
- Split the README into gameplay, development, and publishing references.
- Retained maintained game, layout, collision, force, theme, Android, and sound
  contracts. Their detail is task-specific and remains useful; added reading
  triggers rather than discarding requirements simply because they are long.
- Archived the completed animation spike, campaign audit, Cosmic prompts,
  feature-graphic prompt, old runtime manifest, dated benchmark/release evidence,
  long progress log, asset iterations, and dated multiplayer proposal. The
  proposal remains unimplemented, not rejected. Open follow-ups have a live index.
- Preserved the pre-existing uncommitted progress entry in the archived log.
  Kept the root progress entry point for tools that expect it.
- Kept approved canonical identity/pose prompts next to source assets because
  the package auditor and rebuild workflow consume them; moved superseded
  attempts and branding-generation history to the archive. No source art moved.
- Replaced stale six-frame runtime guidance and Dad/Mum shared-collider claims
  with the current twelve-frame and explicit-profile contracts. Preserved Mum's
  approved proportion/motion exception and Dad's tall normalization.
- Refactored the sole repository skill, create-game-character, into a short
  entry point and three optional references under docs/characters. Preserved
  privacy, identity approval, atlas/hash, roster/motion/collision, full game
  integration, and release validation gates. Corrected the collision auditor path.
- Reviewed the sole agent metadata file, agents/openai.yaml: its four-line
  display name, description, and invocation already match the skill, so retained
  it. The three src/game/ai provider classes are application code, not assistant
  definitions; their integration examples remain in the development reference.
- Kept store alt text, sound rights, and approved Joel identity documentation
  active. Store upload verification is a repeatable gate; old checkmarks are archived.

## Boundaries

Generated dist/ and Android asset/build copies, node_modules, output captures,
and ignored private signing/release records are not public documentation sources.
They were not copied, rebuilt, or published. Global skills were consulted only
as needed and were not edited. Existing Android and capture-script work remains
outside this documentation change.

Validation covers local Markdown targets/anchors, archive content preservation,
skill structure, existing character package audits, and diff whitespace. Runtime
behavior was not changed, so no gameplay or device release pass is claimed.

## Validation results

- 112 local Markdown links and anchors across 56 maintained/archive documents resolve.
- All 19 original records match their pre-audit text after normalizing repaired
  Markdown destinations; the original progress body is preserved verbatim.
- The skill-creator validator passes using an isolated uv runtime with PyYAML.
- Existing character package audits pass for Joel, Dad, and Mum, including
  canonical prompt and runtime-output provenance checks.
- `git diff --check` passes. No runtime tests or external release actions were
  needed for this documentation-only change.
