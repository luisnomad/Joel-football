# Google Play release checklist — Joel Football

Audit date: 2026-07-30

## Recommended release shape

- [ ] Ship the first release as a free, offline game with no ads, analytics,
  accounts, in-app purchases, or remotely loaded game code.
- [ ] Add future free mini-games and music in normal Google Play app updates.
- [ ] Use the existing web/PWA build as the fast-moving version that can update
  independently; keep the installed Play version as a stable snapshot.
- [ ] Use a public support email plus a tiny static support page. Do not add a
  telemetry or crash-reporting SDK for version 1.
- [ ] Use Google Play's free pre-launch report and Android vitals for native
  crashes and ANRs.

This is the lowest-cost, lowest-policy-risk path. The Android build is only
about 20 MB of packaged web assets and the current debug APK is 26.7 MB, so
downloadable asset packs solve no present size problem.

## Current audit snapshot

### Already in good shape

- [x] Permanent-looking application ID:
  `com.notjustprompts.joelfootball`.
- [x] Android App Bundle release command exists: `npm run android:bundle`.
- [x] `compileSdkVersion` and `targetSdkVersion` are API 36, satisfying the
  Google Play requirement that takes effect on 2026-08-31.
- [x] Minimum Android version is API 24.
- [x] Versioning is wired: Android `versionName` reads package version `1.6.0`;
  current optimized release `versionCode` is `4`.
- [x] Adaptive, round, monochrome, splash, and density-specific launcher assets
  exist.
- [x] All game code and content are packaged for offline play.
- [x] Player profile data is local; there is no login or remote account.
- [x] No advertising, analytics, billing, Firebase, or crash SDK is present.
- [x] Merged debug manifest requests only `VIBRATE` and framework-internal
  signature permissions. The offline Android app does not request Internet
  access.
- [x] English and Spanish interfaces exist.
- [x] About screen shows the installed version/build.
- [x] Unit/integration suite passes: 206 tests across 14 files.
- [x] Vite production build passes.
- [x] Debug Android APK builds successfully.
- [x] `npm audit --omit=dev` reports zero known vulnerabilities.
- [x] Art provenance notes exist and describe generated/original assets and
  guardian-approved family likenesses.

### Release blockers found

- [x] **Complete Play Console account registration and identity verification.**
  The account is active, the registration fee is paid, and the public developer
  name is **NotJustPrompts.ai**.
- [ ] **Plan for the new-personal-account test gate.** Recruit at least 12 real
  testers who can stay opted into a closed test continuously for 14 days.
  Production access is not automatic after day 14; an application and review
  follow.
- [x] **Configure release signing.** The ignored local signing properties point
  to the brand-owned upload keystore stored outside the repository, and the
  signed release bundle builds successfully.
- [x] **Fix Android release lint.** The API-28 display-cutout declarations now
  live in `values-v28/styles.xml`; `lintRelease` passes with zero errors.
- [x] **Deploy the prepared privacy/legal page.** It is live at
  `https://notjustprompts.ai/joel-football/legal/`, and the game links to it
  from About.
- [x] **Deploy the prepared support route.** It is live at
  `https://notjustprompts.ai/joel-football/support/`, and Netlify detects the
  `joel-football-support` form.
- [ ] **Configure a public store-listing email.**
- [ ] **Resolve the target-audience declaration honestly.** The child
  characters, simple arcade design, kid-friendly controls, and math challenges
  make a child-inclusive declaration the defensible choice—probably ages
  9–12 plus the genuinely intended older groups. Do not select 13+ merely to
  avoid the Families policy.
- [x] **Audio/SFX provenance is documented.** Tracks 1–6 came from a paid Suno
  subscription, non-music effects came from a paid ElevenLabs subscription,
  and the “¡Vamos!” effect is an authorized original recording of the
  developer's son. Keep the applicable subscription terms, receipts,
  generation records, and original recording privately. Do the same for every
  recognizable person's likeness; private releases/consents should not be
  committed to a public repository.
- [ ] **Complete physical-device testing.** The project's existing Android
  gate requires at least one low/mid-range phone and one modern phone. Add an
  Android 16 tablet/foldable or Pixel Tablet emulator pass.

## Phase 1 — account and identity

- [x] Create a Play Console developer account using a long-lived Google account
  controlled by the developer.
- [ ] Enable two-step verification and save recovery codes.
- [x] Pay the one-time US$25 registration fee and keep its transaction receipt.
- [x] Verify legal identity, legal address, contact email, and contact phone.
- [ ] Verify access to a real, non-rooted Android phone through the Play Console
  mobile app.
- [x] Choose the public developer name: **NotJustPrompts.ai**.
- [ ] Use a public developer/support email that can remain valid for years.
- [ ] Set the developer website to the existing `luisnomad.com` site.
- [ ] Review what identity/contact information Google will display before
  completing the account.
- [ ] In the Android developer verification area, confirm that the new package
  name is registered to the verified identity.

Expected cash cost for the recommended free release: US$25 once. There is no
annual Play developer fee. The existing static website can host privacy/support
pages without a new service.

## Phase 2 — freeze identity, signing, and versioning

- [ ] Confirm the final store title: **Joel Football**.
- [x] Confirm the package name forever:
  `com.notjustprompts.joelfootball`.
- [x] Create an RSA upload key of at least 2048 bits with a validity of at least
  25 years. The key is RSA-4096 and valid through 2053-12-16.
- [x] Store the `.jks` file outside version control in two encrypted backups:
  one separate internal copy and one copy on the external SSD.
- [ ] Copy one verified keystore backup to user-controlled off-site/cloud
  storage. No iCloud/CloudStorage folder was configured on the build Mac.
- [x] Store the alias/passwords in macOS Keychain.
- [x] Create the ignored `android/keystore.properties` from its example file.
- [x] Enrol in Play App Signing and let Google generate/protect the app-signing
  key. The local key should be treated as the replaceable upload key.
- [x] Export and archive the public upload certificate. Certificate SHA-256:
  `79:73:10:53:D5:A2:94:65:5C:84:94:DB:3E:96:DB:FB:88:E4:18:C8:38:16:E4:03:9A:27:6F:46:B0:C6:83:70`.
- [x] Download, fingerprint, and archive Google's deployment certificate and
  quantum-ready RSA/ML-DSA hybrid certificate pair on both backup volumes.
- [x] Increment the redesigned replacement artifact to `versionCode` 3 because
  code 2 was already uploaded to Play. Never reuse an uploaded code.
- [x] Set the redesigned phone experience release to `versionName` 1.6.0.
- [x] Enable R8 code optimization and resource shrinking on AGP 8.13, then
  advance the optimized replacement artifact to `versionCode` 4 because code 3
  was already uploaded to Play.

## Phase 3 — close the technical release blockers

- [x] Move the two API-28 cutout attributes out of base `values/styles.xml` and
  into version-qualified Android resources.
- [x] Rerun `node scripts/run-android-gradle.mjs lintRelease` and require zero
  errors.
- [ ] Review the 30 non-blocking lint warnings:
  - legacy and round icon silhouette warnings;
  - splash density-size inconsistencies;
  - manifest ordering;
  - unused Capacitor template resources/tests;
  - fixed-orientation warning.
- [ ] Visually check the masked adaptive icon and the round icon in Android
  Studio's image asset preview. Do not rely on the square source preview.
- [ ] Test the launch splash on phone and tablet densities without stretching
  or a jarring transition.
- [x] Run `npm run test:responsive:e2e` and inspect every generated setup and
  gameplay capture required by the
  [responsive layout guide](RESPONSIVE_LAYOUT_GUIDE.md).
- [ ] Treat supported-tablet layout, readability, controls, and complete flows
  as release blockers; tablet is the primary fully optimized experience.
- [x] Smoke-test the Casual-mode main journey on one conventional 16:9 phone
  and one modern wide phone. Require no crashes, blocked navigation, invisible
  core controls, unsafe cutout placement, or art/collision mismatch; do not
  require bespoke parity for every extreme handset.
- [x] Run `npm run android:bundle`.
- [x] Confirm the signed AAB exists at
  `android/app/build/outputs/bundle/release/app-release.aab`.
- [x] Verify its certificate with `jarsigner`.
- [ ] Upload it first to Internal testing and inspect Play Console's App Bundle
  Explorer for:
  - effective target SDK 36;
  - device compatibility;
  - delivered download size;
  - permissions;
  - 16 KB page-size compatibility;
  - signing certificates.
- [ ] Make release lint part of the repeatable release command or CI so a
  future bundle cannot skip it.

The Android 16 large-screen orientation change has an explicit exception for
games declared with `android:appCategory="game"`, which this app already does.
Still test landscape lock, rotation, split-screen behaviour, and returning from
external links on Android 16 hardware/emulators.

## Phase 4 — privacy, Families, and app-content declarations

- [x] Publish the prepared privacy/legal page:
  `https://notjustprompts.ai/joel-football/legal/`.
- [x] Add a visible **Privacy** link inside About or Settings.
- [ ] Decide how Android backup should behave:
  - simplest privacy story: set `android:allowBackup="false"`; or
  - retain backup and explicitly disclose that Android may back up locally
    stored settings/progress according to the user's device/account settings.
- [ ] Re-audit the final AAB before declaring **no data collected or shared**.
- [ ] In Data safety, declare no collection/sharing only if the final build
  still contains no telemetry, ads, accounts, or remote reporting.
- [ ] Ads declaration: **No, the app does not contain ads**.
- [ ] App access: all functionality is available without login or special
  credentials.
- [ ] Complete the IARC content-rating questionnaire accurately. Review the
  cartoon impacts, cannonball object, and competitive play rather than
  assuming a rating.
- [ ] Complete Target audience and content with child-inclusive ages that match
  the actual design.
- [ ] Review and comply with the Families policy. The present architecture is
  favourable: no ads, location, identifiers, sign-in, chat, user-generated
  content, camera, or microphone.
- [ ] Answer the other Play Console declarations accurately:
  - financial features: none;
  - health features: none;
  - government affiliation: none;
  - news/magazine: no;
  - advertising ID: not used.
- [ ] Recheck all outbound links because Play policy covers content the app
  links to.

### Outbound YouTube decision

The app uses a neutral creator link to the Luis Nomad music channel rather than
asking children to subscribe or share. The channel owner confirms that public
content is suitable for a general audience and that any explicit material is
age-restricted by YouTube.

- [x] Use neutral creator credit plus separate **YouTube**, **Support**, and
  **Privacy** links.
- [ ] Recheck the signed-out/minor-visible channel landing page before each app
  release so the linked destination remains appropriate for the declared
  audience.

Recommendations, comments, ads, and future channel content remain an ongoing
review surface outside the game.

### Minimal privacy-policy content

The final hosted policy should say, in plain English and Spanish:

1. who operates the game and how to contact them;
2. that the game has no accounts, ads, analytics, or developer-operated
   telemetry;
3. that progress, unlocks, language, difficulty, and audio preferences remain
   on the device;
4. whether Android backup can copy that local data;
5. that selecting an external website/support link opens another service whose
   own privacy policy applies;
6. that the developer does not knowingly collect personal data from children;
7. the effective date and how policy changes will be published.

Do not say that the app collects absolutely nothing if an analytics, bug-report,
remote-content, or billing SDK is added later. Update both the policy and Data
safety form before shipping such a build.

## Phase 5 — store listing

- [ ] Create the app as **Game**, **Free**, with **Spanish (Spain)** as its
  default language; add a manually authored English store-listing translation.
- [ ] Remember: after an app has been offered free, Google Play does not allow
  that same package to become a paid download. It may still add compliant
  one-time in-app products later.
- [ ] Choose category **Sports** (or Arcade only if that better matches the
  intended discovery position) and select accurate tags.
- [ ] Prepare English and Spanish listing text:
  - title, maximum 30 characters;
  - short description, maximum 80 characters;
  - full description, maximum 4,000 characters;
  - release notes for each locale.
- [ ] Do not promise downloadable packs, multiplayer, online features, or
  telemetry that are not in the uploaded build.
- [x] Prepare the 512×512 Play listing icon (32-bit PNG, at most 1 MB).
- [x] Prepare the 1024×500 feature graphic (JPEG or 24-bit PNG, no alpha).
- [x] Capture 4–8 real 16:9 landscape gameplay screenshots at 1920×1080 or
  higher, including:
  - main football match;
  - Kickfall;
  - Disc Hockey;
  - customization or Power Lab;
  - at least one tablet view.
- [x] Localize any marketing text baked into screenshots. Separate English and
  Spanish phone/tablet sets are stored under `Play Store Resources/`.
- [ ] Optional: add a short gameplay video only if its YouTube delivery and
  content are suitable for the declared child-inclusive audience.
- [ ] Add the privacy-policy URL.
- [ ] Add the public support email.
- [ ] Add a support website URL.
- [ ] Select countries/regions deliberately; a small first launch can start
  with Spain plus a few English/Spanish markets and expand later.

## Phase 6 — testing and production access

- [ ] Upload the first AAB to **Internal testing**.
- [ ] Review the automatic pre-launch report for stability, compatibility,
  performance, accessibility, screenshots, and Android 16 devices.
- [ ] Test the Play-delivered build, not only a locally installed debug APK.
- [ ] Recruit at least 12 testers with Google/Workspace accounts.
- [ ] Publish a **Closed testing** release and give testers:
  - opt-in/install instructions;
  - a short route through all three games;
  - the support/private-feedback channel;
  - a reminder to remain opted in continuously for at least 14 days.
- [ ] Keep at least 12 testers opted in for the entire continuous 14-day window.
- [ ] Ask for meaningful use and feedback rather than recruiting idle accounts.
- [ ] During the closed test, verify:
  - cold launch and airplane-mode launch;
  - full football, Kickfall, and Disc Hockey sessions;
  - EN/ES switching and persistence;
  - touch controls and haptics;
  - phone/tablet safe areas and cutouts;
  - pause, Android Back, calls/alarms, lock/unlock, and background/resume;
  - Bluetooth audio latency and music/effects mute;
  - thermal behaviour and frame rate;
  - install/update persistence of the local profile;
  - uninstall/reinstall behaviour;
  - external-link return to the game.
- [ ] Record tester feedback and the fixes made; Play asks questions about the
  test when applying for production access.
- [ ] After the gate is met, apply for Production access. Allow at least seven
  additional days for review and more time if Google asks for further testing.
- [ ] Upload any corrected build with a higher `versionCode`.
- [ ] Rerun the pre-launch report and the full release gate on the exact
  production candidate.
- [ ] Roll out production only after all declarations and listing assets are
  green in Play Console.

## Phase 7 — support without a maintenance machine

- [ ] Create a dedicated support alias, ideally something like
  `joel-football@luisnomad.com`, forwarding to an existing inbox.
- [x] Create a bilingual static support form using Netlify Forms, without
  telemetry, automatic logs, or file uploads.
- [x] Publish it at `https://notjustprompts.ai/joel-football/support/`.
- [ ] Expand the static support page later if useful with:
  - current version;
  - controls/help link;
  - a short known-issues section;
  - contact link;
  - privacy link.
- [x] Add an in-game **Report a problem** button that opens the HTTPS support
  page. The current URL sanitizer allows HTTPS only, which is a good default.
- [ ] On the support page, ask the user to provide:
  - game version/build;
  - device model and Android version;
  - which game/mode;
  - what they expected and what happened;
  - optional screenshot.
- [ ] Do not automatically attach logs, identifiers, profile data, or device
  details.
- [ ] Enable Play Console email alerts for policy issues and Android vitals.
- [ ] Check Android vitals daily for the first week, then only when alerted or
  when preparing an update.
- [ ] Reply to Play reviews when useful, but do not treat reviews as a reliable
  bug tracker.

Google Play's store-listing email is enough for the basic contact requirement.
It is not a structured bug-report system. Closed-test private feedback,
pre-launch reports, Android vitals, and a simple support email/page provide a
reasonable zero-SDK setup.

## Mini-games, music packs, IAP, and updates

### Recommended now: normal free app updates

- [ ] Package each new mini-game/music set in the AAB.
- [ ] Increment `versionCode`, test, and publish a Play update.
- [ ] Let Google Play handle delta delivery and automatic updates.
- [ ] Batch content into occasional meaningful releases to minimise review and
  maintenance effort.

Advantages: no backend, CDN, entitlement state, download manager, purchase
restoration, remote-policy surface, or extra privacy declaration.

### Free remote asset downloads: allowed but not worthwhile yet

Free asset downloads do not require Play Billing. If the game later becomes
large, Play Asset Delivery can host textures/audio as install-time, fast-follow,
or on-demand **asset-only** packs. At the current size, it adds unnecessary
Gradle integration and download/error-state UX.

A custom CDN for free audio/art would also require:

- hosting and availability;
- a signed/versioned content manifest and integrity hashes;
- cache limits and deletion;
- progress, cancellation, retry, offline fallback, and disk-full handling;
- policy review of every remotely served asset;
- privacy-policy/Data safety reassessment.

Do not load new mini-game JavaScript from a server for version 1. Google permits
interpreted runtime code only within policy limits, but it expands review and
security risk and makes the installed game depend on infrastructure.

### Paid packs later: possible, deliberately deferred

Charging for mini-games, music, characters, or other digital content in the
Play-distributed app normally requires Google Play Billing. A permanent pack
would be a non-consumable one-time product. A responsible implementation must
handle pending/completed/cancelled purchases, verification, entitlement,
acknowledgement within three days, restoration on another device, refunds, and
testing. Google recommends backend verification for better security, although
a client-only acknowledgement path exists.

That also introduces a merchant/payments profile, tax and service-fee concerns,
more public business information, customer support expectations, and ongoing
billing-library updates. It conflicts with the present low-maintenance goal.

Decision for the first release:

- [x] Keep the app and all future mini-games, music packs, characters, and other
  content free.
- [x] No Play Billing permission or library.
- [x] No “support the developer” purchase or donation button.

### Do not self-update the Play app

- [ ] Do not download/install a replacement APK from the game.
- [ ] Do not silently replace packaged game code from a server.
- [ ] Do not send users to an outside payment/download flow as an IAP shortcut.

A Play-distributed app may not modify, replace, or update itself outside Play's
update mechanism. The legitimate no-store update channel is the existing web
version. The Android app should receive stable releases through Google Play.

## Low-maintenance post-launch promise

“No maintenance” is not realistic for a public store app. The practical minimum
is:

- [ ] Keep the developer email, identity, privacy/support URLs, and Play account
  valid.
- [ ] Read mandatory Play policy emails.
- [ ] Check alerts after releases.
- [ ] Plan one annual Android target-SDK/dependency refresh so the app remains
  discoverable on new Android versions.
- [ ] Publish urgent fixes for severe crashes, security issues, or policy
  changes.
- [ ] Update Data safety, privacy, target audience, and content rating before
  adding telemetry, ads, accounts, IAP, chat, remote content, or new sensitive
  permissions.

## Official references

- [Create a Play Console account and US$25 fee](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Required account information](https://support.google.com/googleplay/android-developer/answer/13628312)
- [New personal-account testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348)
- [Store preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Target audience and content](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Content ratings](https://support.google.com/googleplay/android-developer/answer/9898843)
- [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [One-time purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time)
- [Play Asset Delivery](https://developer.android.com/guide/playcore/asset-delivery)
- [Device and network abuse / self-update policy](https://support.google.com/googleplay/android-developer/answer/16273414)
- [Pre-launch reports](https://support.google.com/googleplay/android-developer/answer/9842757)
- [Android vitals](https://support.google.com/googleplay/android-developer/answer/9844486)
- [Free/paid app pricing rule](https://support.google.com/googleplay/android-developer/answer/6334373)
