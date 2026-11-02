// node tools/make-latest.js release/DungeonDelve-Setup-X.exe [notes]
// Writes <exe>.blockmap (electron-builder's app-builder) and release/latest.yml in the format electron-updater's
// NsisUpdater reads: version, files[{url, sha512 (base64), size}], path, sha512, releaseDate.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const exe = path.resolve(process.argv[2]);
const name = path.basename(exe);
const m = name.match(/(\d+\.\d+\.\d+)/); if (!m) throw new Error('no version in ' + name);
const version = m[1];
const buf = fs.readFileSync(exe);
const sha512 = crypto.createHash('sha512').update(buf).digest('base64');
const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
const ab = path.join(__dirname, '..', 'electron', 'node_modules', 'app-builder-bin', process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'mac' : 'win', process.arch === 'arm64' ? 'arm64' : 'x64', 'app-builder' + (process.platform === 'win32' ? '.exe' : ''));
const bm = JSON.parse(execFileSync(ab, ['blockmap', '--input', exe, '--output', exe + '.blockmap']).toString());
if (bm.sha512 !== sha512 || bm.size !== buf.length) throw new Error('blockmap tool disagrees with our hash/size');
const yml = `version: ${version}
files:
  - url: ${name}
    sha512: ${sha512}
    size: ${buf.length}
path: ${name}
sha512: ${sha512}
releaseDate: '${new Date().toISOString()}'
`;
const out = path.join(path.dirname(exe), 'latest.yml');
fs.writeFileSync(out, yml);
fs.writeFileSync(exe + '.sha256', `${sha256}  ${name}\n`);
console.log(JSON.stringify({ version, size: buf.length, sha256, sha512, latest: out, blockmap: exe + '.blockmap' }));
