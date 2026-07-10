# Original sound sources

This folder preserves the supplied, full-quality recordings. The browser ships
the optimized copies from `public/assets/sound`.

Run `npm run optimize:audio` after replacing any music source. The optimizer
removes embedded cover art and metadata, converts to broadly compatible
44.1 kHz stereo MP3, and targets 128 kbps. The short mono audience and ball
effects are already small and are copied without an extra lossy encode.
