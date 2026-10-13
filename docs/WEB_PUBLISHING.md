# Web publishing

Optional reading only for an authorized website release. Read or modify the external sibling repository only when it is part of that task.

## Publish through arkdbox.com

The game is built with relative asset URLs, so it can run below any static-site
path. To build it and replace the committed website copy, run:

```bash
npm run publish:website
```

This writes a self-contained build to the sibling ARKD BOX site repository at
`../arkdbox/public/builds/joel-football/`. Commit and push that generated
folder from the `arkdbox` repository; it is served as the raw build at
`https://arkdbox.com/builds/joel-football/`, and players use the play page at
`https://arkdbox.com/play/joel-football/`, which wraps that build.

The old luisnomad.com copy (`/games/joel-football/`) and its legacy
`/games/head-soccer/` stub are retired; luisnomad.com redirects both to the
play page and keeps only a kill-switch service worker for old PWA installs.

The copy step is intentional. Do not commit a symlink to `dist`: Git would
store the link rather than the sibling build contents, and the target would not
exist in the host's isolated checkout. Set `JOEL_FOOTBALL_WEBSITE_DIR` to
override the default sibling repository path on another machine. The former
`SKYHEAD_WEBSITE_DIR` variable remains supported for compatibility. The script
refuses to publish unless the target's `package.json` is named `arkdbox`.
