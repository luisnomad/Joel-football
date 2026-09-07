> Historical record. Optional reading only for asset provenance, previous instructions, or dated verification associated with this file.
> This is past evidence, not current instructions or proof of release readiness.
> Original location: `docs/PERFORMANCE_BENCHMARK.md`; bare relative paths in the record use that location.
> Read external/global references only when relevant to the immediate task; verify changing claims before relying on them.

# Runtime performance benchmark

Performance changes require evidence from the target device. Source polygon
counts, sprite-frame counts, compressed file sizes, and desktop FPS are not
release gates by themselves.

## Tablet soak

1. Install or open the exact release build on the target tablet.
2. Attach Chrome DevTools to the WebView/browser session.
3. In the console, start sampling:

   ```js
   window.__SKYHEAD_PERFORMANCE__.start()
   ```

4. Play for at least five minutes:
   - complete one Football match;
   - use run, jump, kick, dash, power, and chilena;
   - enter Kickfall and reach or debug-jump to a boss;
   - return to setup and cycle through the complete roster twice;
   - revisit Football and Kickfall after cycling the roster.
5. Stop and copy the report:

   ```js
   window.__SKYHEAD_PERFORMANCE__.stop()
   ```

Record the tablet model, OS/WebView version, build commit, renderer, frame
percentiles, long-frame counts, decoded texture estimate, and the largest
resident textures.

## Interpretation

- Compare p95 and p99 frame time between builds; do not optimize from one worst
  frame without reproducing it.
- `framesWithMissedRefresh` uses 1.5× the observed median refresh interval, so
  ordinary 60 Hz timing jitter around 16.7 ms is not mislabeled as jank.
  `estimatedMissedRefreshes` estimates how many display refresh opportunities
  those long intervals skipped.
- A stable decoded-texture estimate after the second roster cycle is expected.
  Growth on every repeated cycle indicates a lifecycle problem.
- Investigate visible stutter together with the browser performance trace.
  Asset decoding, audio startup, garbage collection, and scene transitions can
  cause isolated long frames even when steady gameplay is inexpensive.
- Introduce atlas eviction only if the soak demonstrates continuing residency
  growth, context loss, or device memory pressure. Avoid unloading textures
  still used by live sprites.

## Recorded Galaxy Tab A9+ baseline — 2026-07-30

Build `6b8da0f` plus the uncommitted character-runtime hardening work was built
as a production Vite bundle inside the debug-capable Capacitor wrapper and
installed over the existing app data.

- Device: Samsung SM-X210, Android 16 / API 36, 1920 × 1200 landscape
- WebView: Google WebView 150.0.7871.181
- Renderer: Phaser Canvas; Android compositor pipeline: Skia OpenGL
- Battery: 100%, USB powered; temperature rose from 28.5 °C to 30.0 °C
- Mixed Football/Kickfall soak: 416.8 seconds, 24,801 samples, 59.9 median FPS,
  16.7 ms median, 16.8 ms p95/p99, and 23 intervals above 33.3 ms
- Android mixed-soak deadline misses: 95 / 24,090 frames (0.39%); GPU p95
  5 ms and p99 11 ms
- Warm Football: 30.01 seconds, 1,796 samples, 16.7 ms median, 16.8 ms p95/p99,
  17.2 ms worst, and zero intervals above 33.3 ms
- Warm Football Android deadline misses: 6 / 2,678 frames (0.22%); GPU p99
  11 ms
- Warm Kickfall level 10 with Mum and a boss: 30.01 seconds, 1,795 samples,
  16.7 ms median, 16.8 ms p95/p99, 33.4 ms worst, and one interval above
  33.3 ms
- Warm Kickfall Android deadline misses: 8 / 3,693 frames (0.22%); GPU p99
  8 ms
- Decoded residency after every character sheet and both game modes:
  110.48 MiB. A complete second roster cycle remained at 60 textures and
  110.48 MiB, a 0 MiB increase.
- Final Android process memory after the fully warmed roster and Kickfall:
  231,081 KiB total PSS and 333,112 KiB total RSS.

One black interval during the mixed run was caused by the benchmark driver
attempting to start the lazily registered Kickfall scene without going through
`MiniGameLoading`. The Android process remained PID 10150, logged no error, and
subsequently completed level 10. That invalid transition is excluded from the
warm per-scene samples.
