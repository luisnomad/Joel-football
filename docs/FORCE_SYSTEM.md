# Shared Impulse and Pressure System

## Purpose

The force system turns a player's intuitive “kick it harder” behaviour into a
reusable game rule. A direct strike creates an impulse, connected objects
transmit a diminishing portion of it, and resistant endpoints can accumulate
temporary pressure until they release or break.

The renderer-independent implementation lives in
`src/game/pure/forceSystem.js`. It has no Phaser or Matter dependency and is
intended for Kickfall, future minigames, and an eventual Football integration.
Games remain responsible for finding contacts and moving their physics bodies.

## Shared API

- `resolveForceTransmission`: attenuates an impulse over one or more contacts.
  A gap beyond the caller's limit or force below the minimum returns zero.
- `resolveForceCombo`: rewards repeated impacts into the same caller-defined
  context during a short time window. The multiplier is capped.
- `resolvePressureImpact`: adds force to temporary pressure and reports whether
  the endpoint released. A caller may preserve reliable direct releases.
- `decayPressure`: removes stored pressure after a grace period.
- `resolveForceDamage`: converts impulse into capped permanent damage for gates,
  armour, or similar objects.
- `resolveDifficultyPressureTuning`: scales resistance and pressure decay
  without changing transmission physics.

Context IDs belong to the consuming game. Kickfall uses `laneId:direction`;
Football might use a possession, collision sequence, or shot target ID.

## Invariants

1. Force never increases while travelling through passive contacts.
2. A physical gap breaks the chain.
3. One kick serial may affect a given endpoint only once.
4. Repeated-impact multipliers have a short window and a hard cap.
5. Difficulty changes resistance and decay, not ball movement or attenuation.
6. Direct, well-positioned interaction remains the fastest and most reliable
   solution.
7. Stored pressure must be visible through object feedback; it must not be a
   hidden counter.

## Kickfall integration

Kickfall's tuning is exported as `KICKFALL_FORCE_CONFIG` from
`src/game/minigames/kickfall/kickfallRules.js`.

| Setting | Value |
| --- | ---: |
| Force retained per ball contact | 0.84 |
| Maximum gap still treated as contact | 8 px |
| Minimum meaningful force | 0.12 |
| Combo window | 0.9 seconds |
| Combo multipliers | 1.0, 1.25, 1.5 |
| Maximum running approach bonus | 20% |
| Gate resistance per health pip | 0.7 |
| Cleat hold resistance | 1.1 |
| Pocket/magnet hold resistance | 1.5 |
| Pressure grace period | 0.5 seconds |
| Normal pressure decay | 0.8 per second |

A direct player kick has zero transmission hops and releases either trap in one
clean hit. A remote impact is multiplied by `0.84` for every intervening ball.
The captive ball remains held while the trap stores the surviving force.
Rapid later kicks add pressure; waiting allows it to decay.

The trap itself owns pressure, last-impact time, force, hop count, and kick
serial. Its red overlay remains faintly active in proportion to stored pressure
and pulses with intensity based on each new impact. Releasing the captive ball
resets pressure. A gate converts incoming force to fractional health damage,
with a maximum of one health pip per kick.

Difficulty profiles are:

| Difficulty | Resistance | Decay rate |
| --- | ---: | ---: |
| Easy | 0.85× | 0.75× |
| Normal | 1.0× | 1.0× |
| Hard | 1.2× | 1.25× |

This makes remote clearing more forgiving on Easy and more demanding on Hard
while keeping identical ball handling. Direct trap kicks remain one-hit
releases at every difficulty.

## Diagnostics and tests

`render_game_to_text` exposes:

- active combo context, stage, multiplier, and last kick force;
- every ball's remaining impulse and hop count;
- gate incoming force, damage, and hop count;
- trap resistance, stored pressure, pressure ratio, and last-impact hop count.

Pure tests live in `test/force-system.test.js`. Kickfall unit coverage verifies
its chosen attenuation and resistances. Browser coverage creates real
four-ball queues: the medium cleat requires two rapid rear kicks and the strong
pocket requires three, while direct captive kicks still release in one.

## Reusing it in Football

Do not import Kickfall tuning into Football. Import only the shared pure module
and define Football-specific contexts and resistance values.

Good initial uses include transmitting shot impulse through crowded ball/player
contacts, making charged kicks contribute more force to a contested ball, and
driving destructible or movable special-match objects. Preserve Football's
existing kick velocity and collision feel first; introduce shared force as
metadata on top of those collisions, then tune it with isolated tests.
