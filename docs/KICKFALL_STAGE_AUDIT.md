# Kickfall Campaign Route Audit

This is the authored-layout safety review for all twenty Kickfall stages.
`D`, `F`, and `U` mean downhill, flat, and uphill. The finish window is the
clock time remaining after the last scheduled ball appears.

Every row is checked in pure tests and reopened in the browser campaign audit.
For every listed receiver, the browser drops a physical ball, waits for the
handoff, measures its distance from the outer wall, places the character at the
resulting strike point, and requires a real collision kick to connect.

| Level | Tier modes | Required inward receivers | Gates A/B/C | Obstacles / rival | Finish window | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | D/D/D/D | — | 1/1/1 | — | 69.0s | Pass |
| 2 | D/D/D/D | — | 1/1/1 | Upper pocket, lower cleat | 36.2s | Pass |
| 3 | F/D/D/D | Top intake is player-passable | 1/1/1 | — | 56.3s | Pass |
| 4 | D/F/D/D | Upper flat | 1/1/1 | Upper pocket | 52.8s | Pass |
| 5 | F/D/F/D | Lower flat | 1/2/1 | Lower cleat | 51.3s | Pass |
| 6 | U/D/D/D | Top intake is player-passable | 1/1/1 | — | 67.6s | Pass |
| 7 | D/U/D/D | Upper uphill | 1/1/1 | Upper pocket | 62.0s | Pass |
| 8 | U/D/F/D | Lower flat | 2/1/1 | Lower cleat | 58.8s | Pass |
| 9 | D/U/D/F | Upper uphill, bottom flat | 2/2/1 | Upper pocket, lower cleat | 56.0s | Pass |
| 10 | D/F/D/D | Upper flat | 1/2/1 | Lower cleat, rival ×3 | 69.8s | Pass |
| 11 | F/U/D/D | Upper uphill | 2/1/2 | — | 57.0s | Pass |
| 12 | U/F/D/D | Upper flat | 1/2/1 | Upper pocket, lower cleat | 54.2s | Pass |
| 13 | U/D/U/D | Lower uphill | 2/2/2 | Lower cleat | 55.3s | Pass |
| 14 | F/U/F/D | Upper uphill, lower flat | 1/2/2 | Upper pocket, lower cleat | 52.2s | Pass |
| 15 | U/F/U/D | Upper flat, lower uphill | 2/2/2 | Upper pocket, lower cleat | 51.4s | Pass |
| 16 | U/U/F/D | Upper uphill, lower flat | 2/2/3 | Upper pocket | 50.7s | Pass |
| 17 | F/U/U/F | Upper uphill, lower uphill, bottom flat | 2/3/2 | Top cleat, upper pocket, lower cleat | 48.1s | Pass |
| 18 | U/F/U/U | Upper flat, lower uphill, bottom uphill | 3/2/3 | Upper pocket, bottom pocket | 47.8s | Pass |
| 19 | U/U/F/U | Upper uphill, lower flat, bottom uphill | 3/3/3 | Top cleat, upper pocket, lower cleat | 47.3s | Pass |
| 20 | U/F/U/D | Upper flat, lower uphill | 3/3/3 | Top cleat, upper pocket, lower cleat, rival ×5 | 83.7s | Pass |

The tightest physical receiver result is 182.2 px of entry-wall clearance. The
regression floor is 100 px, which covers the character body, the direct-kick
offset, and additional visual breathing room. The top tier does not need a
triangle: its separate intake rail collides with balls only, so the character
can always walk behind a flat or backsliding top ball.
