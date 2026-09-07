# Original sound sources

Optional reading for audio processing or rights provenance. Read external/global references
only when relevant to the immediate task.

This folder preserves the supplied, full-quality recordings. The browser ships
the optimized copies from `public/assets/sound`.

## Rights and provenance

The developer confirmed the following provenance for the shipped audio:

- `track1.mp3` through `track6.mp3` are original music generated with Suno
  while the developer had a paid subscription that granted rights to use the
  generated tracks.
- All shipped non-music sound effects other than `vamos_sound_effect.mp3` were
  generated with ElevenLabs while the developer had a paid subscription that
  granted commercial use of the generated audio. This includes the goal,
  audience, ball, whistle, button/menu, power-up, wall, level-finished, and
  hockey effects under `public/assets/sound/`.
- `vamos_sound_effect.mp3` is derived from
  `source-assets/sound/vamos_sound_effect.m4a`, an original family recording of
  the developer's son saying “¡Vamos!” It is used with parental authorization.

Subscription receipts, the applicable service terms from the generation
period, generation/project records, and the unedited family recording should
be retained privately as release evidence. Do not commit account records,
receipts, or private consent documents to the repository.

Run `npm run optimize:audio` after replacing any music or encoded effect source. The optimizer
removes embedded cover art and metadata, converts to broadly compatible
44.1 kHz stereo MP3, and targets 128 kbps. The short mono audience and ball
effects are already small and are copied without an extra lossy encode.
