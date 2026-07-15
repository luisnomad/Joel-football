# Android client

Joel Football uses Capacitor as a native client shell. The Phaser/Vite source
remains shared with the website: `npm run build` creates `dist/`, and Capacitor
copies that exact folder into the Android application.

## Toolchain

- Node.js 22 or later
- Java 21 (recommended for the generated Gradle 8.14 project)
- Android SDK 36
- Android Studio for device deployment and profiling

Android Gradle commands run through `scripts/run-android-gradle.mjs`, which
selects the installed Java 21 runtime automatically on macOS. On other systems,
set `JOEL_ANDROID_JAVA_HOME` when the shell default is incompatible:

```bash
export JOEL_ANDROID_JAVA_HOME=/path/to/jdk-21
```

## Commands

```bash
npm run android:sync   # build Vite, copy dist/, and sync plugins
npm run android:open   # sync, then open the project in Android Studio
npm run android:run    # sync, then choose a connected target
npm run android:apk    # signed debug APK for device testing
npm run android:tablet # create/reuse a Pixel Tablet, install, and launch
npm run android:bundle # signed release AAB; requires private signing config
```

In Visual Studio Code, run **Tasks: Run Task** from the Command Palette and
choose **Android: Launch Tablet**. The first run creates an AVD named
`Joel_Football_Tablet` from the best compatible system image already installed
in the Android SDK. Later runs reuse the same emulator and update the app.

The debug APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. Android's debug keystore
signs it automatically, making it directly installable for testing.

## Release signing

1. Confirm the permanent application ID. It is currently
   `com.luisnomad.joelfootball`.
2. Create and protect a Play upload keystore outside version control.
3. Copy `android/keystore.properties.example` to
   `android/keystore.properties` and fill in its four values.
4. Increment `versionCode` in `android/app/build.gradle` and the semantic
   `version` in `package.json`. Gradle reads `versionName` directly from that
   package metadata so the Android package, web build, and About overlay agree.
5. Run `npm run android:bundle`.

The signing properties and all `.jks`/`.keystore` files are ignored. The bundle
command refuses to run without complete signing values instead of silently
producing an unsigned release artifact.

## Native behavior

- Android phone activities use sensor landscape orientation.
- System bars start hidden in edge-to-edge mode. Modern WebView
  `env(safe-area-inset-*)` values keep Phaser outside camera cutouts. Capacitor
  CSS injection is disabled because Capacitor 8 can attempt its first injection
  before `document.documentElement` exists; the modern path was verified on
  Android WebView 149 and the Pixel 9 Pro camera-cutout emulator.
- The scale manager refreshes after the asynchronous native orientation lock,
  on orientation changes, and after returning to the foreground.
- Landscape touch tablets below 16:9 use Phaser's extended stage: the pitch
  remains 1280×720, the canvas grows downward to the device aspect ratio, and
  the arena floor pattern plus menu/gameplay controls occupy that extra band.
  Exact 16:9 tablets, phones, and desktop browsers retain the original layout.
- Backgrounding releases all keyboard/touch/sprint state, pauses physics and
  audio, and requires an explicit resume.
- Back closes About or Help first. Help owns the pause it creates and resumes
  only that pause; backgrounding while Help is open converts it to an explicit
  lifecycle pause. Otherwise Back pauses/resumes a match, dismisses Lab layers,
  returns from Settings, and minimizes only from the unobstructed main menu.
- The first fresh profile detects and saves the primary device language.
  Pressing EN/ES marks a durable user override that later device-locale changes
  cannot replace. Older profiles preserve their existing language.
- Launcher assets include legacy and adaptive icons, an Android 13 monochrome
  treatment, and matching density-specific native splash images. The editable
  master is `source-assets/branding/joel-football-app-icon-master.png`.
- All game art, scripts, and audio are packaged in the APK. Browser profile
  data remains in the Capacitor WebView's local storage across normal app
  updates and is already schema-sanitized by `PlayerProfileStore`.

## Physical-device release gate

Before calling the Capacitor phase complete, run full solo matches on at least
one low/mid-range phone and one modern phone. Record frame rate and inspect
touch accuracy, cutouts, Bluetooth audio latency, calls/alarms, screen lock,
background/resume, update persistence, airplane-mode launch, thermal behavior,
WebView texture memory, and rendering differences. An emulator smoke test is
useful, but it does not satisfy this physical-device gate.
