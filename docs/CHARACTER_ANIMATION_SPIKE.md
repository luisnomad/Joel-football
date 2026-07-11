# Character animation spike

Date: 2026-07-10

Implementation status: completed. The vertical slice was successful and was
extended to both players. Runtime uses three unique authored run drawings in a
four-phase distance-driven loop plus three staged kick drawings. Source prompts,
reference sheets, candidates, selected frames, and final atlas mapping are in
`source-assets/animation/README.md`.

## Decision

Keep the characters as raster artwork. Add a small number of deliberately
authored frames for the run and kick actions and pack them into registered
texture atlases. Keep planted feet on one shared ground anchor; do not add
display-origin vertical motion to grounded poses.

Do not convert the current flattened PNG characters to SVG for this iteration.
SVG conversion does not recover joints or hidden body parts, and Phaser loads
SVG artwork into raster textures rather than retaining an animatable SVG scene.

The recommended vertical slice is one character with:

- a four-frame run loop (three new frames plus the current running frame);
- a three-frame kick (new anticipation, current contact, new follow-through);
- the current idle, jump, dash, and stun poses;
- stable source-space foot registration plus optional non-vertical lean or
  impact accents that never move planted feet through the pitch.

That adds five drawings per character and brings each character to eleven
frames. It should deliver most of the visible improvement without introducing a
skeletal runtime or changing the gameplay physics.

## What the game has today

The current assets are richer than a three-pose setup:

- each character sheet is 1254 x 1254 with six 418 x 627 cells;
- the cells represent idle, one run stride, jump, kick, dash, and stun;
- the fighters render at approximately 185 x 240;
- the run loop alternates the run drawing with the idle drawing;
- kick and dash hold one drawing for about 160 ms and 140 ms respectively;
- the Matter compound body stays stable while the visual frame changes.

The chief problem is the large silhouette change between consecutive frames.
During a run, the character repeatedly changes from a planted standing body to
a long airborne stride. The cadence can be fast, but there is no passing pose or
opposite-foot contact to sell weight transfer. The kick similarly has no
anticipation or recovery, so it snaps in and out.

The two current sheets are about 1.8 MB combined on disk and roughly 12 MiB
combined when decoded as RGBA textures. Adding frames affects download and
texture memory, but it does not require more visible game objects: each fighter
can remain one Phaser Sprite displaying one atlas frame. Runtime animation cost
should therefore remain very small for two fighters.

## Option comparison

| Option | Visual ceiling | Production risk | Runtime cost | Fit for this game |
| --- | --- | --- | --- | --- |
| Targeted registered raster frames | High at the current display size | Medium; new drawings need cleanup | Very low | Best |
| AI or optical-flow in-betweens, baked to raster | Medium when motion is small | High; limbs and facial features can morph | Very low after baking | Useful only as an authoring experiment |
| Segmented raster puppet with bones | High for reusable movement, sometimes visibly puppet-like | High; hidden limbs and clean joints must be reconstructed | Low to medium | Consider only for a much larger move set or roster |
| Auto-traced SVG poses and path morphing | Low without a manual redraw | Very high; traced poses do not share compatible paths | Medium | Poor |
| Manually rebuilt vector character rig | High | Very high initial art cost | Low to medium | A future art-pipeline decision, not a quick animation fix |

### Why SVG is not the shortcut it appears to be

An auto-traced SVG is still one flattened picture. It does not know where the
shoulder, elbow, knee, or hip is. Independently tracing two poses also produces
different path topology, so paths cannot be cleanly interpolated between them.

To make SVG useful, an artist would need to rebuild each player as a layered
puppet with complete torso and limb pieces, define pivots and draw order, and
then animate the rig. The same rig could use raster parts; vectorization is not
what provides the animation. Phaser's standard SVG loader rasterizes SVG input
into a bitmap texture, so a separate vector/skeletal runtime would also be
required for actual path or bone animation.

## Recommended asset workflow

Use AI generation as a drafting tool, not as the final consistency system:

1. Choose one existing frame as the character identity reference.
2. Create a fixed pose guide for each missing frame. A rough silhouette or
   skeleton is more valuable than another prose-only prompt.
3. Generate or edit one transparent frame at a time, always with the identity
   frame, outfit palette, and adjacent animation frames as references. Do not
   ask a model for another multi-pose sheet.
4. Generate several candidates and reject anatomy, face, hair, clothing, and
   shoe inconsistencies early.
5. Manually repair the selected frames. At minimum, normalize head size, eye
   placement, limb thickness, palette, outlines, and alpha edges.
6. Register every frame to the same ground/foot anchor and logical canvas.
7. Preview the loop at its final 185 x 240 display size. Many high-resolution
   defects disappear there, while anchor jumps and proportion changes remain
   obvious.
8. Pack approved frames into a trimmed atlas with named frames and pivot data.

Offline frame interpolation can be tested between closely related run frames,
but it should never be accepted automatically. Interpolation between the
current idle and full-stride drawings is too large a motion and is likely to
produce melted limbs or double contours.

## Runtime design

Keep gameplay and visual timelines separate:

- the existing movement, collision body, strike window, and cooldowns remain
  authoritative;
- a small visual state machine selects `idle`, `run`, `jump`, `kick`, `dash`,
  `stun`, and `chilena` animations;
- the run animation advances from distance travelled, not just elapsed time,
  preventing feet from cycling while the fighter is barely moving;
- kick contact remains synchronized with the existing strike window, while the
  visual follow-through may continue after contact;
- state changes can use one or two frames of squash/lean, but should not
  cross-fade whole character drawings because that creates a ghosted double
  silhouette;
- the physics body must not be rebuilt for every visual frame.

Use Phaser's Animation Manager with a named, trimmed texture atlas instead of
manual numeric frame selection. Preserve the current fixed foot-level anchor so
wide kick and dash poses do not move the player's apparent ground contact.

### Suggested animation budget

| State | Frames | Playback |
| --- | ---: | --- |
| Idle | 1 | 1-2% breathing scale and 1-2 px vertical motion |
| Run | 4 | Distance-driven, roughly 10-14 displayed frames/second |
| Jump | 1 current pose | Brief takeoff stretch and landing squash |
| Kick | 3 | Anticipation, contact, follow-through; contact keeps current game timing |
| Dash | 1 current pose | 2-3 degree lean and short stretch |
| Stun | 1 current pose | Existing effect is sufficient |
| Chilena | 1 current pose | Keep the existing whole-sprite rotation |

Do not add frames to every action in the first pass. Run and kick occupy the
most attention and currently have the largest visual discontinuities.

## Texture and performance guardrails

- Keep one visible Sprite per fighter.
- Target source frames around 2x their display size, approximately 370 x 480,
  unless visual comparison proves 1.5x is sufficient.
- Trim transparent borders and pack each character into an atlas no larger than
  2048 x 2048.
- Aim for no more than 20 MiB combined decoded texture memory for both character
  atlases and no more than 4 MB combined transfer size.
- Test on a representative mobile device. The acceptance target is the existing
  frame rate with no measurable animation-related spikes during two-player
  movement and simultaneous effects.
- Keep the fixed collision geometry and deterministic gameplay diagnostics.

The atlas frame count itself is not a meaningful per-frame rendering burden.
The main performance risk is oversized, poorly packed source textures, which
the atlas limits address.

## Vertical slice and decision gate

Build only Joel's run and kick first.

Rough scope:

- asset generation, selection, and cleanup: one to two working days;
- atlas and visual-state integration: about one working day;
- tuning and mobile/browser verification: half a day.

The slice passes if:

- the head and torso no longer pop in size between run frames;
- at least one foot appears planted through the contact portions of the cycle;
- the run cadence follows movement speed without sliding at low speed;
- the kick clearly reads as anticipation, contact, and recovery;
- the strike timing and all existing gameplay tests remain unchanged;
- the final-size loop looks coherent without relying on a still-frame zoom;
- the game retains its existing frame-rate behavior on mobile.

If the new raster frames cannot meet the identity and proportion checks after
two focused art iterations, stop generating more frames. The fallback spike
should be a segmented raster rig for one character, not an SVG auto-trace. A
full rig becomes worthwhile only if the roadmap needs many more actions,
costumes, or characters that can reuse the same skeleton.

## References

- Phaser animation concepts: https://docs.phaser.io/phaser/concepts/animations
- Phaser textures and atlases: https://docs.phaser.io/phaser/concepts/textures
- Phaser SVG loader: https://docs.phaser.io/api-documentation/class/loader-loaderplugin#svg
