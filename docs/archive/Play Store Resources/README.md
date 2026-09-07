> Historical record. Optional reading only for asset provenance, previous instructions, or dated verification associated with this file.
> This is past evidence, not current instructions or proof of release readiness.
> Original location: `Play Store Resources/README.md`; bare relative paths in the record use that location.
> Read external/global references only when relevant to the immediate task; verify changing claims before relying on them.

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

## Google Play checks

- [x] App icon is a 512×512 32-bit PNG under 1 MB.
- [x] Feature graphic is a 1024×500 24-bit PNG without transparency.
- [x] Every screenshot is a 24-bit PNG without transparency.
- [x] Every screenshot is exactly 1920×1080 and shows the current game.
- [ ] English screenshots are assigned to `en-US`.
- [ ] Spanish screenshots are assigned to `es-ES`.
- [ ] Phone and tablet screenshots are uploaded to their matching device slots.
