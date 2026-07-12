import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const androidRoot = path.join(projectRoot, 'android');
const isWindows = process.platform === 'win32';
const gradle = path.join(androidRoot, isWindows ? 'gradlew.bat' : 'gradlew');
const defaultSdkRoot = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library/Android/sdk')
  : isWindows
    ? path.join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk')
    : path.join(os.homedir(), 'Android/Sdk');

const env = {
  ...process.env,
  ANDROID_HOME: process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? defaultSdkRoot,
  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? defaultSdkRoot,
};

if (process.env.JOEL_ANDROID_JAVA_HOME) {
  env.JAVA_HOME = process.env.JOEL_ANDROID_JAVA_HOME;
} else if (process.platform === 'darwin') {
  const javaHome = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
  if (javaHome.status !== 0) {
    process.stderr.write('Java 21 is required. Install it or set JOEL_ANDROID_JAVA_HOME.\n');
    process.exit(1);
  }
  env.JAVA_HOME = javaHome.stdout.trim();
}

const tasks = process.argv.slice(2);
if (tasks.length === 0) {
  process.stderr.write('Pass at least one Gradle task, for example assembleDebug.\n');
  process.exit(1);
}

const result = spawnSync(gradle, tasks, {
  cwd: androidRoot,
  env,
  stdio: 'inherit',
  shell: isWindows,
});
process.exit(result.status ?? 1);
