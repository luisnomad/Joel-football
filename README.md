# Joel Football

A bilingual arcade game built with Phaser 3, Matter physics, Vite, and Capacitor.
It includes Football, Kickfall, and Disc Hockey. Tablets are the primary
experience; phones use the compact Casual layout in the same app.

## Run

Use Node.js 22 or later:

```bash
npm install
npm run dev
```

Open the displayed local URL. See [gameplay](docs/GAMEPLAY.md) for controls,
Power Lab, customization, and mini-games.

## Verify

```bash
npm test
npm run build
npm run test:e2e
npm run test:disc-hockey:e2e
npm run test:responsive:e2e
npm run test:playtest-fixes:e2e
npm run test:offline:e2e
```

Run the suites relevant to the change; gameplay releases require the full
applicable gate and visual inspection of browser captures in `output/`.
Agents must follow [AGENTS.md](AGENTS.md), including the shell wrapper rule.

## Optional task references

Read only what is relevant to the immediate task:

- [Documentation index](docs/README.md): product contracts and task guides.
- [Development](docs/DEVELOPMENT.md): source map, opponent providers, audio.
- [Android](docs/ANDROID.md): builds, signing, device checks.
- [Web publishing](docs/WEB_PUBLISHING.md): website release procedure.
- [Character skill](.agents/skills/create-game-character/SKILL.md): invoke
  `$create-game-character` with supplied photos or approved art; identity and
  final likeness require human approval.
- [Open work](docs/OPEN_WORK.md): release follow-ups and deferred proposals.
- [Archive](docs/archive/README.md): historical evidence, only when needed.

External sites, sibling repositories, and global skills are optional references;
read them only when relevant to the immediate task.
