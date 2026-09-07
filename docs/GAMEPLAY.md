# Gameplay guide

Optional reading for controls, game rules, setup, or audio behavior.

## Power Lab

The main screen opens Joel's Power Lab, which contains ten distinct powers.
Choose a power, then solve a system-selected problem to earn one charge. Every
challenge independently randomizes between two-digit addition, nontrivial
subtraction, multiplication through 12×12, and exact division using those
tables, so players cannot repeatedly choose the easiest operation. Charges
accumulate locally across refreshes.

An incorrect answer starts a persistent five-minute Lab cooldown. Only an
earned power can be equipped, and equipping a new one replaces the previous
selection. The equipped charge enhances Joel's next successful full-meter
power strike; missed kicks do not consume charges.

## Controls

- Move: A/D or Left/Right; touch builds use the matching on-screen arrows
- Directional dash: double-tap either keyboard or on-screen direction within
  280 ms
- Jump: W, Up, or Space
- Kick: X or K
- Lob: Z or I (or hold Up while pressing Kick)
- Power: V or J when the meter is full
- Boosted kick/lob: repeat either kick button during the kick animation; energy
  is spent only if the ball is hit
- Pause: P or Escape
- Restart: R
- Fullscreen: F

Touch controls appear on touch/coarse-pointer devices. Kid-friendly action
icons replace the old K/L/D/P labels and match the localized Help overlay.
The top-row buttons provide pause, restart, main menu, Help, and fullscreen, so
tablet play does not depend on a keyboard. The pause overlay also exposes
resume, restart, and menu.

Football's experimental horizontal joystick remains available to developers
without adding a player-facing setting:

```sh
VITE_FOOTBALL_TOUCH_MOVEMENT_MODE=joystick npm run dev
```

The default and every unsupported value resolve to `arrows`. For a live debug
session, set the Phaser registry key
`developer:footballTouchMovementMode` to `joystick` and restart the Match
scene. This switch affects Football only; Kickfall keeps its 8-way joystick.

The home screen's info button opens localized credits, the dedication to Joel,
and the authoritative installed version/build. Help is available from home and
live play; opening it during a match pauses safely, and Android Back closes it
before affecting the match or activity.

Settings offers persistent Easy, Normal, and Hard AI difficulty. Easy prevents
the rival from using directional dashes or boosting basic kicks; Normal and
Hard allow both.

## Fields and kickable objects

Open **Field & Ball** on the home screen to choose a persistent match setup.
The three fields are Skycourt Stadium, Neon Grid, and Sunset Beach. Object
choices include two football designs plus a party balloon, rugby ball, soda
can, and cannonball.

The football designs deliberately share the same competitive physics. The fun
objects do not: the balloon is buoyant and draggy, the rugby ball wobbles into
unpredictable bounces, the can uses a tumbling box collider, and the cannonball
is heavy, low-bouncing, and hard to lift. Object radius is respected by kicks,
power-shot sweeps, arena recovery, crossbar release, and goal detection.

## Mini-games

The Mini-games journey currently offers two separately loaded games:

- **Kickfall**, a four-tier arcade course with a twenty-level campaign. Balls
  collide and stack; deliberate kicks send diminishing impulse through
  connected queues. Gates and traps react to the reusable force system.
- **Disc Hockey**, a three-minute top-down match against three computer
  difficulties, a second local player, or four coordinated Hard rivals in
  Crazy Mode / Modo Loco. Crazy Power charges through play and unleashes one
  rival-scattering Super Shot. Its white-ice and yellow/red neon arenas share
  identical physics, velocity-sensitive contact audio, and a four-second
  crease rule that ejects goal campers and empties Crazy Power.

Kickfall's playable scene is a dynamic Vite import and its backdrop, ramp,
gate, and ball art live under `public/assets/minigames/kickfall/`. Neither the
scene chunk nor those exclusive assets is requested during initial startup.
Disc Hockey is a second independent dynamic scene chunk and uses the globally
selected player/opponent portraits plus existing game audio. See
`docs/KICKFALL_SPEC.md`, `docs/FORCE_SYSTEM.md`, and
`docs/DISC_HOCKEY_SPEC.md` for the complete contracts.

Both players can cross midfield. Before passing the defender, retreating is a
backpedal and each character keeps facing the rival goal. After passing the
defender, movement can turn the attacker back toward them; continuing toward
goal still keeps shots aimed at that goal.

Lobs adapt to the defender's distance. A nearby defender produces the bounded
maximum-height arc, clearing their head by a wide margin and forcing them to
retreat toward the projected landing point. As distance increases, the launch
trades height for horizontal speed while still targeting space beyond them.
