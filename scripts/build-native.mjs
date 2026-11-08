import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const identity = JSON.parse(readFileSync('version.json', 'utf8'));
const version = identity.version;
const prefix = `natally-v${version}`;
const destination = resolve('dist', prefix);
const targets = resolve(process.env.CARGO_TARGET_DIR || 'build/native-target');
const androidHome = process.env.ANDROID_HOME || join(homedir(), 'Android/Sdk');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const json = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function prepare() {
  const pkg = readJson('package.json');
  pkg.version = version;
  json('package.json', pkg);
  const lock = readJson('package-lock.json');
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  json('package-lock.json', lock);
  const cargoFile = 'src-tauri/Cargo.toml';
  const cargo = readFileSync(cargoFile, 'utf8').replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  writeFileSync(cargoFile, cargo);
  const cargoLock = 'src-tauri/Cargo.lock';
  writeFileSync(cargoLock, readFileSync(cargoLock, 'utf8').replace(/(name = "natally-ai-studio"\nversion = ")[^"]+/, `$1${version}`));
  const config = readJson('src-tauri/tauri.conf.json');
  config.version = version;
  config.build.beforeBuildCommand = '';
  config.build.frontendDist = '../dist-web';
  config.build.devUrl = 'http://localhost:37841';
  for (const window of config.app.windows) {
    window.title = `Natally v${version}`;
    window.url = 'app.html';
  }
  const [major, minor, build] = version.split('.').map(Number);
  const code = major * 100000000 + minor * 10000 + build;
  if (!Number.isSafeInteger(code) || code >= 2100000000) throw Error('Android versionCode exceeds platform range');
  config.bundle.android.versionCode = code;
  config.bundle.windows.wix.version = `${major}.${minor}.${build}.0`;
  json('src-tauri/tauri.conf.json', config);
  mkdirSync(destination, { recursive: true });
  console.log(`Native identity prepared: ${config.identifier}, v${version}, Android versionCode ${code}`);
}

if (process.argv[2] === 'prepare') {
  prepare();
} else {
  if (process.env.NATALLY_CANONICAL_BUILD !== '1') throw Error('Use build_all.sh for native packaging');
  mkdirSync(destination, { recursive: true });
  mkdirSync(join(destination, 'logs'), { recursive: true });
  const manifest = { version, builtAt: identity.builtAt, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), artifacts: [], targets: {} };
  const inventoryPath = join(destination, 'inventory.json');
  const children = new Set();
  const save = () => json(inventoryPath, manifest);
  const childEnv = { ...process.env, CARGO_TARGET_DIR: targets, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome, APPIMAGE_EXTRACT_AND_RUN: '1', GRADLE_OPTS: '-Dorg.gradle.daemon=false' };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    for (const child of children) {
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill(); } catch { }
    }
    manifest.interrupted = signal;
    save();
    process.exit(130);
  });
  function run(label, command, args, cwd = root) {
    const logfile = join(destination, 'logs', label + '.log');
    console.log(`\n=== ${label}: ${command} ${args.join(' ')} ===`);
    const fd = openSync(logfile, 'a');
    return new Promise((done) => {
      const child = spawn(command, args, { cwd, env: childEnv, detached: process.platform !== 'win32', stdio: ['ignore', fd, fd] });
      children.add(child);
      child.once('error', error => { children.delete(child); closeSync(fd); done({ code: 1, message: error.code || error.message }); });
      child.once('exit', code => { children.delete(child); closeSync(fd); done({ code: code ?? 1, log: logfile }); });
    });
  }
  function files(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
  }
  function stage(file, name, kind) {
    if (!existsSync(file)) throw Error(`Missing ${kind}: ${file}`);
    const out = join(destination, `${prefix}-${name}`);
    copyFileSync(file, out);
    const data = readFileSync(out);
    manifest.artifacts.push({ kind, path: out.slice(root.length + 1), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    save();
    console.log(`Staged ${kind}: ${out}`);
  }
  function stageBundles(dir, extensions, label) {
    for (const ext of extensions) {
      const matches = files(dir).filter(file => file.endsWith(ext) && basename(file).includes(version));
      if (matches.length !== 1) throw Error(`${label}: expected one current-version ${ext}, found ${matches.length}`);
      stage(matches[0], `${label}${ext}`, label + ext);
    }
  }
  async function target(name, execute, collect) {
    manifest.targets[name] = { state: 'running' }; save();
    const startedAt = new Date().toISOString();
    try {
      const result = await execute();
      if (result.code !== 0) throw Error(`${name} command failed (${result.code}); see ${result.log || result.message}`);
      await collect();
      manifest.targets[name] = { state: 'packaged', startedAt, finishedAt: new Date().toISOString() };
    } catch (error) {
      manifest.targets[name] = { state: 'failed', startedAt, error: error.message };
      console.error(error.message);
    }
    save();
  }
  await target('linux', () => run('linux', 'npx', ['--no-install', 'tauri', 'build', '--bundles', 'appimage,deb,rpm', '--', '--locked']), () => {
    stageBundles(join(targets, 'release/bundle'), ['.AppImage', '.deb', '.rpm'], 'linux-x64');
  });
  await target('windows', () => run('windows', 'npx', ['--no-install', 'tauri', 'build', '--runner', 'cargo-xwin', '--target', 'x86_64-pc-windows-msvc', '--bundles', 'nsis', '--', '--locked']), () => {
    stage(join(targets, 'x86_64-pc-windows-msvc/release/natally-ai-studio.exe'), 'windows-x64.exe', 'windows-executable');
    stageBundles(join(targets, 'x86_64-pc-windows-msvc/release/bundle/nsis'), ['.exe'], 'windows-x64-installer');
  });
  await target('windows-msi', async () => {
    // wixl packages the staged Windows executable into a per-machine MSI on
    // Linux (ARCHITECTURE.md "Windows MSI (Store)"). Ubuntu ships wixl as its
    // own package, Debian inside msitools, so request both and fall back.
    if (spawnSync('wixl', ['--version']).error) {
      let install = await run('msitools', 'sudo', ['apt-get', 'install', '-y', 'msitools', 'wixl']);
      if (install.code !== 0) install = await run('msitools', 'sudo', ['apt-get', 'install', '-y', 'msitools']);
      if (install.code !== 0) throw Error(`msitools/wixl install failed (${install.code}); see ${install.log || install.message}`);
    }
    const config = readJson('src-tauri/tauri.conf.json');
    const upgradeCode = config.bundle?.windows?.wix?.upgradeCode;
    if (!upgradeCode) throw Error('tauri.conf.json bundle.windows.wix.upgradeCode missing for MSI');
    const manufacturer = /authors\s*=\s*\[\s*"([^"]+)"/.exec(readFileSync('src-tauri/Cargo.toml', 'utf8'))?.[1];
    if (!manufacturer) throw Error('src-tauri/Cargo.toml authors missing for MSI manufacturer');
    const [major, minor, build] = version.split('.').map(Number);
    const output = join(targets, 'msi', `${prefix}-windows-x64.msi`);
    mkdirSync(join(targets, 'msi'), { recursive: true });
    // wixl can exit 0 without writing its output (e.g. missing parent dir);
    // drop any stale file so stage() can only ever see this run's product.
    rmSync(output, { force: true });
    return run('windows-msi', 'wixl', ['-a', 'x64', '-o', output,
      '-D', `ProductName=${config.productName}`,
      '-D', `ProductVersion=${major}.${minor}.${build}.0`,
      '-D', `UpgradeCode=${upgradeCode}`,
      '-D', `Manufacturer=${manufacturer}`,
      '-D', `ExeSource=${join(destination, `${prefix}-windows-x64.exe`)}`,
      '-D', `IconSource=${resolve('src-tauri/icons/icon.ico')}`,
      'src-tauri/msi/natally.wxs']);
  }, () => {
    stage(join(targets, 'msi', `${prefix}-windows-x64.msi`), 'windows-x64.msi', 'windows-msi');
  });
  await target('android', () => run('android', 'npx', ['--no-install', 'tauri', 'android', 'build', '--target', 'aarch64', '--apk', '--aab']), async () => {
    const output = 'src-tauri/gen/android/app/build/outputs';
    // Gradle stamps the current version into artifact names (build.gradle.kts
    // archivesName "natally-ai-studio-v" + version from version.txt), so
    // versioned leftovers from earlier invocations accumulate beside this
    // run's outputs instead of being overwritten (v1.24.765 failed with four
    // release AABs from v1.20/v1.22/v1.23/v1.24). Collect only the current
    // stamped version's artifacts.
    const stamp = `v${version}-`;
    const apks = files(join(output, 'apk')).filter(p => p.endsWith('.apk') && !p.includes('unsigned') && !p.includes('debug') && basename(p).includes(stamp));
    const aabs = files(join(output, 'bundle')).filter(p => p.endsWith('.aab') && !p.includes('debug') && basename(p).includes(stamp));
    if (apks.length !== 1 || aabs.length !== 1) throw Error(`Android release APK/AAB were not uniquely produced for v${version}; found: ${[...apks, ...aabs].map(p => basename(p)).join(', ') || 'none'}`);
    const toolsRoot = join(androidHome, 'build-tools');
    const versions = readdirSync(toolsRoot).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    const tool = versions.map(v => join(toolsRoot, v)).find(d => existsSync(join(d, 'apksigner')) && existsSync(join(d, 'zipalign')));
    if (!tool) throw Error('Complete Android build tools unavailable');
    const signature = execFileSync(join(tool, 'apksigner'), ['verify', '--print-certs', apks[0]], { encoding: 'utf8' });
    const actual = /certificate SHA-256 digest:\s*([0-9a-f:]+)/i.exec(signature)?.[1].replaceAll(':', '').toUpperCase();
    const expected = childEnv.ANDROID_SIGNING_CERT_SHA256.replaceAll(':', '').toUpperCase();
    if (!actual || actual !== expected) throw Error('Android APK signer does not match the configured production certificate');
    execFileSync(join(tool, 'zipalign'), ['-c', '-P', '16', '4', apks[0]], { stdio: 'inherit' });
    execFileSync('jarsigner', ['-verify', aabs[0]], { stdio: 'ignore' });
    stage(apks[0], 'android-arm64.apk', 'android-apk');
    stage(aabs[0], 'android-arm64.aab', 'android-aab');
    const symbols = files(join(output, 'native-debug-symbols')).filter(p => p.endsWith('.zip') && p.includes('release') && basename(p).includes(stamp));
    if (symbols.length === 1) stage(symbols[0], 'android-arm64-native-debug-symbols.zip', 'android-symbols');
    else {
      const ndks = readdirSync(join(androidHome, 'ndk')).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
      const llvm = ndks.map(v => join(androidHome, 'ndk', v, 'toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-objcopy')).find(existsSync);
      if (!llvm) throw Error('NDK llvm-objcopy unavailable for native debug symbols');
      const symbolRoot = resolve('build', prefix + '-symbols');
      const abiDir = join(symbolRoot, 'arm64-v8a'); mkdirSync(abiDir, { recursive: true });
      const library = join(targets, 'aarch64-linux-android/release/libnatally_ai_studio_lib.so');
      execFileSync(llvm, ['--only-keep-debug', library, join(abiDir, 'libnatally_ai_studio_lib.so.dbg')]);
      const archive = join(destination, `${prefix}-android-arm64-native-debug-symbols.zip`);
      execFileSync('zip', ['-r', archive, 'arm64-v8a'], { cwd: symbolRoot, stdio: 'inherit' });
      const data = readFileSync(archive);
      manifest.artifacts.push({ kind: 'android-symbols', path: archive.slice(root.length + 1), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  });
  manifest.finishedAt = new Date().toISOString();
  manifest.complete = ['linux', 'windows', 'windows-msi', 'android'].every(name => manifest.targets[name]?.state === 'packaged');
  save();
  console.log(JSON.stringify({ version, complete: manifest.complete, targets: manifest.targets, inventory: inventoryPath }, null, 2));
  process.exitCode = manifest.complete ? 0 : 1;
}
