# Character collision guide

Optional reading for character or collider changes. Read external/global references
only when relevant to the immediate task.

## Runtime contract

Football deliberately uses a stable compound Matter body: torso, foot, head,
and an overlapping upper-head cap. Animation frames are display-only. Kicks use
a temporary forward strike capsule, and the chilena uses a reach test plus the
same stable airborne body.

This is the production default. Swapping a detailed polygon on every animation
frame would move mass, contact normals, and penetration depth during a pose
change. It should be considered only if measured playtesting identifies a move
that the stable body plus a temporary sensor cannot represent.

`visualScale`, `frameScales`, screen resolution, CSS scaling, and device aspect
ratio do not resize Football physics. Deliberately larger gameplay geometry
must come from a named `collisionProfile`. Dad and Mum use larger profiles by
design; the other roster members use `standard`.

## Head-coverage gate

The fixed body must cover the nominal grounded idle head before a character can
ship. The comparison uses:

- the atlas's real non-transparent idle bounds;
- the shared source foot anchor at `y=418`;
- the final Football display scale;
- the character's explicit collision profile;
- the actual pitch anchor at logical `y=636`.

Run the full-roster gate after adding or changing any atlas, `visualScale`, or
collision profile:

```bash
rtk python .agents/skills/create-game-character/scripts/audit_roster_collision_coverage.py \
  --root .
```

The audit fails if visible idle art begins more than four logical pixels above
the fixed collider. It checks every catalog character, not only the new one.
This is intentional: a shared geometry change can silently regress the rest of
the roster.

The gate was added after physical tablet play exposed a shared blind strip. The
old head-cap formula used the sprite-position offset (`89`) as if it were the
compound body's lower bound (`70`). That shortened standard head coverage by
19 logical pixels and large-profile coverage by 22.8 pixels. Joel made the bug
obvious, but the atlas audit showed that all eight characters were affected.

## What the automated gate does not claim

An idle silhouette is the stable reference for the main body. A raised boot,
hand, ponytail, or leaned action drawing is not automatically part of the
physical body. Action contact belongs to a temporary sensor when it affects
gameplay.

For a new or substantially redrawn character, also inspect Football with the
collider diagnostic visible:

- idle and the complete run loop on both sides;
- jump takeoff, apex, and landing;
- kick anticipation, contact, and recovery;
- dash and stun;
- chilena launch, rotation, and landing;
- Big Guy at full scale;
- a real ball approaching the hairline from above and both upper corners.

If the face or cranium moves outside the stable cap during an action, first
correct frame registration. If the motion is intentional and affects play, add
a short-lived pose sensor with explicit tests. Do not enlarge the whole torso
or swap per-frame polygons merely to cover a decorative limb.

## Device validation

Use logical coordinates in assertions. On the Galaxy Tab A9+ used for the
original regression, the physical screen was 1920×1200 and the WebView was
about 1442×901 CSS pixels, while Phaser continued to simulate a 1280×800 world.
Different scaling can expose input ergonomics, but it does not explain a
different Matter collision result.

For touch-only combinations, test a human interval rather than two consecutive
simulation frames. Football's touch chilena accepts the second matching Kick
or Lob tap from 45 through 480 ms. Keyboard timing remains tied to its existing
fast input path.
