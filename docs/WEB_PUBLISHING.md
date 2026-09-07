# Web publishing

Optional reading only for an authorized website release. Read or modify the external sibling repository only when it is part of that task.

## Publish through luisnomad.com

The game is built with relative asset URLs, so it can run below any static-site
path. To build it and replace the committed website copy, run:

```bash
npm run publish:website
```

This writes a self-contained build to the sibling Astro repository at
`../luisnomad.com/public/games/joel-football/`. Commit and push that generated
folder from the `luisnomad.com` repository; Astro copies `public/` unchanged and
Netlify publishes it at `/games/joel-football/`. The publish command also keeps
`/games/head-soccer/` as a tiny redirect so existing bookmarks continue to work.

The copy step is intentional. Do not commit a symlink to `dist`: Git would
store the link rather than the sibling build contents, and the target would not
exist in Netlify's isolated checkout. Set `JOEL_FOOTBALL_WEBSITE_DIR` to override
the default sibling repository path on another machine. The former
`SKYHEAD_WEBSITE_DIR` variable remains supported for compatibility.
