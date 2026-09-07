# Google Play release checklist

Optional reading for Android release work. This is a repeatable gate, not a
claim that any candidate has passed. Record results against the exact AAB.
Read external references only for the immediate release question and verify
current Play Console requirements before relying on dates, limits, or policy.

## Product boundary

Keep the existing free, offline, child-inclusive release with no ads, analytics,
accounts, billing, or remote game code unless the user approves a product change.
Commercial quality applies even when the download is free. Package new content
through ordinary Play updates. Preserve the tablet-first/Casual-phone contract.

## Account, identity, and signing

- Confirm developer identity, package ownership, account recovery, two-step
  verification, required device verification, and durable public contact details.
- Keep `com.notjustprompts.joelfootball` stable. Read the version from
  `package.json` and `android/app/build.gradle`; never reuse an uploaded code.
- Use the existing protected upload key and Play App Signing. Verify encrypted
  backups, including an off-site copy, and archive public certificates privately.
  Never commit keys, passwords, receipts, or consent records.
- Follow [Android signing](ANDROID.md#release-signing) to build a signed AAB.

## Candidate validation

- Run unit tests, production build, Football/Kickfall, Disc Hockey, and responsive
  browser suites. Inspect the screenshots and console errors.
- Run `node scripts/run-android-gradle.mjs lintRelease`; resolve errors and
  review warnings, including icons, splash densities, and orientation.
- Build `npm run android:bundle`. Verify the final AAB's package, version,
  certificate, target SDK, permissions, size, and compatibility with bundletool,
  jarsigner, and Play's App Bundle Explorer. Do not trust stale intermediates.
- Test the Play-delivered build on supported tablets and representative low/mid
  and modern phones; cover Android large-screen behavior and cutouts. Follow
  [responsive acceptance](RESPONSIVE_LAYOUT_GUIDE.md),
  [device checks](ANDROID.md#physical-device-release-gate), and
  [performance measurement](PERFORMANCE_BENCHMARK.md).
- Cover cold/offline launch, all games, EN/ES, touch/haptics, pause/Back,
  rotation, background/resume, calls/alarms/lock, Bluetooth audio, mute,
  thermal behavior, install/update persistence, reinstall, and external-link return.
- Retain artifact hash, matching R8 reports, device evidence, and release results
  privately. Past passes do not satisfy this candidate's gate.

## Privacy, audience, and listing

- Re-audit the final artifact before completing Data safety, ads, app access,
  IARC rating, audience/Families, and other declarations. Match actual behavior;
  do not choose older audience bands merely to avoid child protections.
- Resolve Android backup behavior and disclose it accurately. Review generated
  audio/art rights and likeness consent; keep supporting records private.
- Verify bilingual privacy/support pages and in-app links. Review the creator
  channel as visible signed out/to minors; keep its credit neutral.
- Privacy copy must identify the operator/contact, local data, backup behavior,
  external-service boundaries, effective date, and actual collection practices.
- Confirm title, category, countries, Spanish default and English translation,
  current text limits, support email, and localized release notes.
- Use [store assets](<../Play Store Resources/README.md>) and matching alt text.
  Verify dimensions/formats and actual gameplay; upload each locale/device set
  to the correct slots. Do not advertise unimplemented features.

## Testing, rollout, and support

- Upload to the appropriate testing track; inspect pre-launch reports and vitals.
- Verify the account's current closed-testing/production-access requirements in
  Play Console. Recruit active testers, preserve opt-in/feedback evidence, fix
  findings, and apply for production access when eligible.
- Re-run the release gate on each corrected candidate with a higher version code.
  Publish only within the user's authorization after declarations and assets pass.
- Maintain a durable support channel. Request version, device, mode, expected
  behavior, and observed failure without automatically attaching personal data.
- Enable policy/vitals alerts; monitor the first release week and subsequent
  alerts. Plan SDK/dependency maintenance and urgent crash/security/policy fixes.
- Reassess disclosures before introducing telemetry, billing, accounts, chat,
  remote content, or permissions. Do not implement an APK/code self-updater or
  use an external payment/download flow as a shortcut.

## Optional references

Consult only the source relevant to the current release question:

- [Play account requirements](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Testing and production access](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Target SDK](https://developer.android.com/google/play/requirements/target-sdk)
- [App signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Store assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Original release audit](archive/docs/PLAY_STORE_RELEASE_CHECKLIST.md): dated
  completion evidence, detailed declarations, and deferred monetization options.
