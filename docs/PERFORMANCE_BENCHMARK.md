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


Optional historical comparison: [Galaxy Tab A9+ baseline](archive/docs/PERFORMANCE_BENCHMARK.md#recorded-galaxy-tab-a9-baseline--2026-07-30). Re-measure on the target build; this is not a current pass.
