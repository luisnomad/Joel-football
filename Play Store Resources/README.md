# Joel Football — Google Play Store Resources

Upload-ready artwork and localized screenshots for the first Google Play
release.

## Folder map

- `icon/`: 512×512 Play Store listing icon.
- `feature-graphic/`: 1024×500 promotional feature graphic.
- `en-US/phone/` and `en-US/tablet/`: English 1920×1080 screenshots.
- `es-ES/phone/` and `es-ES/tablet/`: Spanish 1920×1080 screenshots.
- `source/`: preserved source artwork used to create final promotional assets.
- `screenshots-manifest.json`: generated screenshot inventory and dimensions.
- `ALT_TEXT.md`: localized accessibility descriptions for every asset.

## Recommended upload order

1. Football action
2. Kickfall action
3. Disc Hockey action
4. Match customization
5. Mini-game selection

All screenshots depict the real application. Generated artwork is restricted to
the feature graphic and does not claim gameplay that is absent from the game.

## Regenerate screenshots

Run `node scripts/capture-play-store-screenshots.mjs` from the project root.

## Release checks

Recheck the icon, feature graphic, and screenshots against current Play formats
and the actual release candidate. Upload English/Spanish sets to their matching
locale and phone/tablet slots. Consult external Play requirements only when
relevant to this release task.

Optional reading: [release checklist](../docs/PLAY_STORE_RELEASE_CHECKLIST.md),
[previous asset checks](<../docs/archive/Play Store Resources/README.md>), and
[feature graphic prompt](<../docs/archive/Play Store Resources/source/feature-graphic-prompt.md>)
for reproduction of the existing art.
