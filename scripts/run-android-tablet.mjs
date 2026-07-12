import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const avdName = process.env.JOEL_ANDROID_TABLET_AVD ?? 'Joel_Football_Tablet';
const appId = 'com.luisnomad.joelfootball';
const apkPath = path.join(projectRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
const isWindows = process.platform === 'win32';

const defaultSdkRoot = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library/Android/sdk')
  : isWindows
    ? path.join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk')
    : path.join(os.homedir(), 'Android/Sdk');
const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? defaultSdkRoot;
const executable = (relativePath, windowsExtension = '.exe') => path.join(
  sdkRoot,
  `${relativePath}${isWindows ? windowsExtension : ''}`,
);
const emulator = executable('emulator/emulator');
const adb = executable('platform-tools/adb');
const avdmanager = executable('cmdline-tools/latest/bin/avdmanager', '.bat');
const npm = isWindows ? 'npm.cmd' : 'npm';

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const capture = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${path.basename(command)} exited with ${result.status}`);
  }
  return result.stdout.trim();
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: options.env ?? process.env,
    input: options.input,
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) fail(`${path.basename(command)} exited with ${result.status}`);
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const findInstalledSystemImage = async () => {
  const imagesRoot = path.join(sdkRoot, 'system-images');
  const images = [];
  for (const api of await readdir(imagesRoot).catch(() => [])) {
    for (const tag of await readdir(path.join(imagesRoot, api)).catch(() => [])) {
      for (const architecture of await readdir(path.join(imagesRoot, api, tag)).catch(() => [])) {
        if (!existsSync(path.join(imagesRoot, api, tag, architecture, 'source.properties'))) continue;
        images.push({ api, tag, architecture, packageId: `system-images;${api};${tag};${architecture}` });
      }
    }
  }
  const preferredArchitecture = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
  images.sort((left, right) => {
    const score = (image) => (
      (image.architecture === preferredArchitecture ? 10_000 : 0)
      + (image.tag.includes('playstore') ? 1_000 : image.tag.includes('google_apis') ? 500 : 0)
      + (Number.parseFloat(image.api.replace('android-', '')) || 0)
    );
    return score(right) - score(left);
  });
  return process.env.JOEL_ANDROID_SYSTEM_IMAGE ?? images[0]?.packageId ?? null;
};

const ensureTabletAvd = async (env) => {
  const avds = capture(emulator, ['-list-avds'], { env }).split(/\r?\n/).filter(Boolean);
  if (avds.includes(avdName)) return;
  const systemImage = await findInstalledSystemImage();
  if (!systemImage) {
    fail('No Android system image is installed. Install one from Android Studio > SDK Manager, then rerun the task.');
  }
  process.stdout.write(`Creating Pixel Tablet AVD ${avdName} with ${systemImage}...\n`);
  run(avdmanager, [
    'create', 'avd',
    '--force',
    '--name', avdName,
    '--package', systemImage,
    '--device', 'pixel_tablet',
  ], { env, input: 'no\n' });
};

const connectedEmulators = (env) => capture(adb, ['devices'], { env })
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter(([serial, state]) => serial?.startsWith('emulator-') && state === 'device')
  .map(([serial]) => serial);

const findRunningTablet = (env) => connectedEmulators(env).find((serial) => {
  try {
    return capture(adb, ['-s', serial, 'emu', 'avd', 'name'], { env }).split(/\r?\n/)[0] === avdName;
  } catch {
    return false;
  }
});

const waitForTablet = async (env) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const serial = findRunningTablet(env);
    if (serial) return serial;
    if (attempt % 5 === 0) process.stdout.write('Waiting for the tablet emulator...\n');
    await delay(2_000);
  }
  fail(`Timed out waiting for ${avdName} to connect.`);
};

const waitForBoot = async (serial, env) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      if (capture(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { env }) === '1') return;
    } catch {
      // adb may briefly disconnect while the virtual device finishes starting.
    }
    if (attempt % 5 === 0) process.stdout.write('Waiting for Android to finish booting...\n');
    await delay(2_000);
  }
  fail(`Timed out waiting for Android to boot on ${serial}.`);
};

if (![emulator, adb, avdmanager].every(existsSync)) {
  fail(`Android SDK tools were not found under ${sdkRoot}. Set ANDROID_SDK_ROOT and rerun the task.`);
}

const env = {
  ...process.env,
  ANDROID_HOME: sdkRoot,
  ANDROID_SDK_ROOT: sdkRoot,
};
if (process.env.JOEL_ANDROID_JAVA_HOME) {
  env.JAVA_HOME = process.env.JOEL_ANDROID_JAVA_HOME;
} else if (process.platform === 'darwin') {
  try {
    env.JAVA_HOME = capture('/usr/libexec/java_home', ['-v', '21'], { env });
  } catch {
    fail('Java 21 is required. Install it or set JOEL_ANDROID_JAVA_HOME before rerunning the task.');
  }
}

await ensureTabletAvd(env);
process.stdout.write('Building and syncing the debug APK...\n');
run(npm, ['run', 'android:apk'], { env });

let serial = findRunningTablet(env);
if (!serial) {
  process.stdout.write(`Starting ${avdName}...\n`);
  const child = spawn(emulator, [`@${avdName}`, '-no-snapshot-save', '-no-boot-anim'], {
    cwd: projectRoot,
    env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  serial = await waitForTablet(env);
}

await waitForBoot(serial, env);
if (!existsSync(apkPath)) fail(`APK not found at ${apkPath}`);
process.stdout.write(`Installing Joel Football on ${serial}...\n`);
run(adb, ['-s', serial, 'install', '-r', apkPath], { env });
run(adb, ['-s', serial, 'shell', 'input', 'keyevent', '82'], { env });
run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${appId}/.MainActivity`], { env });
process.stdout.write(`Joel Football is running on ${avdName} (${serial}).\n`);
