#!/bin/sh
# Rebuild the game and package the Windows desktop app into ./release  (runs on Linux, no wine needed)
#   sh tools/package.sh          -> Windows: zip, portable exe, NSIS installer + latest.yml/.blockmap/.sha256 for the auto-updater
#   sh tools/package.sh linux    -> Linux unpacked app (for smoke tests)
# Never publishes: electron-builder runs with --publish never and without GH_TOKEN in its environment.
set -e
cd "$(dirname "$0")/.."
node build.js
mkdir -p electron/app && cp index.html electron/app/index.html
cd electron
[ -d node_modules/electron-updater ] || npm install --no-audit --no-fund
EB="env -u GH_TOKEN -u GITHUB_TOKEN npx electron-builder --publish never"
if [ "$1" = "linux" ]; then $EB --linux dir --x64; exit 0; fi
VERSION=$(node -p "require('./package.json').version")
rm -rf ../release/win-unpacked
$EB --win zip --x64                                   # win-unpacked + zip (afterPack.js sets the icon); writes resources/app-update.yml
# electron-builder only writes this for updater targets (nsis), so write the same file ourselves: the app reads it to find releases
printf 'owner: delishyp\nrepo: Dungeon-Delve\nprovider: github\nupdaterCacheDirName: dungeon-delve-updater\n' > ../release/win-unpacked/resources/app-update.yml
$EB --win portable --x64 --prepackaged ../release/win-unpacked
NSIS=$(ls -d ~/.cache/electron-builder/nsis/nsis-3* | head -1)
chmod +x "$NSIS/linux/makensis"
NSISDIR="$NSIS" "$NSIS/linux/makensis" -V2 -DVERSION="$VERSION" installer.nsi   # electron-builder's own NSIS target needs wine; this one does not
rm -f ../release/*.blockmap ../release/builder-debug.yml ../release/*.nsis.7z ../release/latest.yml
cd ..
node tools/make-latest.js "release/DungeonDelve-Setup-$VERSION.exe"
ls -la release | grep -v '^d'
