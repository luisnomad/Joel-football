# Kickfall visual themes

Kickfall rendering is selected through `kickfallThemes.js`. A theme is a visual
skin, not a level definition. It may replace the background, lane material,
gate, catch rail, cleat, colors, and ambient timing without changing gameplay
geometry or physics.

## Registered themes

| ID | Role | Default |
| --- | --- | --- |
| `cosmic` | Layered Cosmic Foundry production skin | Yes |
| `workshop` | Original neon workshop skin and compatibility fallback | No |

Unknown IDs resolve to `cosmic`. Scene data may supply `themeId`, and the same
field can later be persisted by a screen-design selector without changing the
Kickfall scene API.

## Cosmic Foundry runtime pack

All files live under `public/assets/minigames/kickfall/themes/cosmic/` and are
requested only by the Kickfall scene.

| Role | File | Runtime format and size | Rendering |
| --- | --- | --- | --- |
| Base sky/city | `cosmic-backdrop-v1.webp` | 1280×720 WebP | Full-bleed base |
| Milky Way | `cosmic-milky-way-v1.webp` | 1536×864 WebP | Black-backed additive layer |
| Moon | `cosmic-moon-v1.webp` | 640×640 WebP | Black-backed additive layer |
| Lane material | `cosmic-platform-v1.webp` | 1024×192 WebP | Stretched along authored tier angle |
| Energy gate | `cosmic-gate-v1.png` | 191×448 alpha PNG | Visual over unchanged 60×112 body |
| Catch rail | `cosmic-catch-v1.png` | 576×92 alpha PNG | Visual over existing pocket rule |
| Kick cleat | `cosmic-cleat-v1.png` | 384×63 alpha PNG | Visual over existing cleat rule |

Full generated sources and chroma-key alpha intermediates live under
`source-assets/kickfall/cosmic/`.

## Adding another screen design

1. Add a versioned asset folder under
   `public/assets/minigames/kickfall/themes/<theme-id>/`.
2. Add unique texture keys and a lazy asset list to `kickfallThemes.js`.
3. Provide every texture role. A new theme may intentionally reuse a texture
   from another registered theme by referencing that key and manifest entry.
4. Define its palette and ambient motion values. Do not add tier coordinates,
   collision dimensions, obstacle capture radii, or level rules to the theme.
5. Select the theme through Kickfall scene data or a future persisted profile
   option. The scene loads only that manifest.
6. Run the pure theme contract, production build, and browser suite. Verify
   asset laziness before entry, layer diagnostics after entry, pause freezing,
   queue readability, gate damage, obstacles, flat wedges, and tablet framing.

Background and lane selections are separate texture roles inside the theme, so
a future UI can offer complete presets or compose variants without touching the
physics implementation.
