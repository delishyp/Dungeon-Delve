#!/bin/sh
# One-command release:   sh tools/release.sh 2.5.0 "What's new, for players"   [--dry-run]
#  1. sets the version in electron/package.json      2. builds everything (tools/package.sh)
#  3. splits the installer into parts                4. commits + pushes the source to GitHub (main)
#  5. creates GitHub Release v<version> and uploads: Setup exe, latest.yml, .blockmap, .sha256
#   sh tools/release.sh 2.4.0 "notes" --publish-only   uploads the already-built files in release/ (no rebuild, no commit)
# Installed games (v2.4.0+) see the new release on their next launch and offer to update.
# Needs env GH_TOKEN (fine-grained, Contents read/write on delishyp/Dungeon-Delve). The token is only ever
# passed to curl/git through stdin/env — never on a command line, never written to a file, never printed.
set -e
cd "$(dirname "$0")/.."
OWNER=delishyp; REPO=Dungeon-Delve
V="$1"; NOTES="$2"; DRY=""; ONLY=""; [ "$3" = "--dry-run" ] && DRY=1; [ "$3" = "--publish-only" ] && ONLY=1   # --publish-only: upload what is already in release/
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "usage: sh tools/release.sh X.Y.Z \"notes\" [--dry-run|--publish-only]"; exit 1; }
[ -n "$NOTES" ] || { echo "please give short release notes"; exit 1; }
[ -n "$DRY" ] || test -n "$GH_TOKEN" || { echo "GH_TOKEN is not set"; exit 1; }
set +x
EXE="release/DungeonDelve-Setup-$V.exe"
# Only these paths are ever committed by a release (other agents' boards/notes in the repo root stay local).
SRC_PATHS=".gitignore PLAYTEST_NOTES.md README.md package.json package-lock.json assets build.js electron icons src test tools"

# -- 1. prerequisites, checked BEFORE anything is changed
AB="electron/node_modules/app-builder-bin/linux/x64/app-builder"
[ -d electron/node_modules/electron-updater ] && [ -d electron/node_modules/electron-builder ] || { echo "missing electron/node_modules: run (cd electron && npm ci)"; exit 1; }
[ -x "$AB" ] || { echo "missing $AB: run (cd electron && npm ci)"; exit 1; }
command -v curl >/dev/null && command -v git >/dev/null || { echo "need curl and git"; exit 1; }
if [ -n "$ONLY" ]; then
  test -s "$EXE" || { echo "--publish-only: $EXE has not been built"; exit 1; }
else
  # makensis comes from electron-builder's cache (the portable step downloads it if absent); warn early if it is not there yet
  ls -d "$HOME"/.cache/electron-builder/nsis/nsis-3* >/dev/null 2>&1 || echo "   note: NSIS not cached yet; electron-builder will download it during the portable step"
fi

# -- 2. version must increase over what is published (publish-only of an already-built installer is exempt)
CUR=$(node -p "require('./electron/package.json').version")
PUB=$(curl -fsSL "https://github.com/$OWNER/$REPO/releases/latest/download/latest.yml" 2>/dev/null | sed -n 's/^version: *//p' | head -1)
vgt() { node -e "const a=process.argv[1].split('.').map(Number),b=process.argv[2].split('.').map(Number);for(let i=0;i<3;i++){if(a[i]!==b[i])process.exit(a[i]>b[i]?0:1)}process.exit(1)" "$1" "$2"; }
echo "== Dungeon Delve: source $CUR, published ${PUB:-unknown} -> $V"
if [ -z "$ONLY" ]; then
  if [ -n "$PUB" ]; then vgt "$V" "$PUB" || { echo "refusing: $V is not newer than published $PUB"; exit 1; }
  else [ -n "$DRY" ] || { echo "could not read the published version from GitHub; refusing to guess"; exit 1; }; fi
fi

if [ -z "$ONLY" ]; then
  # restore package.json if the build fails part-way
  cp electron/package.json /tmp/dd-package.json.$$
  trap 'if [ "$OK" != 1 ]; then cp /tmp/dd-package.json.$$ electron/package.json; echo "== failed: electron/package.json restored to $CUR"; fi; rm -f /tmp/dd-package.json.$$' EXIT
  node -e "const f='electron/package.json',j=require('./'+f);j.version='$V';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
  sh tools/package.sh
  sh tools/split-parts.sh "$V"
else
  # publish an already-built installer: rebuild latest.yml/.blockmap/.sha256 from that exe. Source is NOT touched or committed.
  node tools/make-latest.js "$EXE" >/dev/null
fi
for f in "$EXE" "$EXE.blockmap" "$EXE.sha256" release/latest.yml; do test -s "$f" || { echo "missing $f"; exit 1; }; done
grep -q "^version: $V$" release/latest.yml
OK=1   # build is complete and consistent: keep package.json at $V from here on
if [ -n "$DRY" ]; then echo "== dry run: built $EXE, nothing published"; exit 0; fi

api() {  # api METHOD URL [datafile] [content-type]   (auth header goes to curl via stdin config, not argv)
  printf 'header = "Authorization: Bearer %s"\n' "$GH_TOKEN" | curl -sS -K - -X "$1" "$2" \
    -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
    ${3:+--data-binary @"$3"} ${4:+-H "Content-Type: $4"}
}
# -- source to main (the release tag points at it). git gets the token from env via a credential helper.
[ -d .git ] || { echo "no git repo"; exit 1; }
if [ -z "$ONLY" ]; then   # full build: commit exactly the source paths this build was made from
  git add -A -- $(for p in $SRC_PATHS; do [ -e "$p" ] && echo "$p"; done)
  git diff --cached --quiet || git -c user.name="Dungeon Delve" -c user.email="dungeon-delve@users.noreply.github.com" commit -qm "Release v$V"
else
  echo "   publish-only: not committing the working tree; tagging current HEAD $(git rev-parse --short HEAD)"
fi
git grep -n "github_pat_\|ghp_" -- . ":(exclude)tools/release.sh" >/dev/null 2>&1 && { echo "token-like string in repo, aborting"; exit 1; } || true
git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' push -q origin HEAD:main
SHA=$(git rev-parse HEAD)
# -- release
TMP=$(mktemp)
NOTES="$NOTES" V="$V" SHA="$SHA" node -e "require('fs').writeFileSync(process.argv[1],JSON.stringify({tag_name:'v'+process.env.V,target_commitish:process.env.SHA,name:'Dungeon Delve v'+process.env.V,body:process.env.NOTES,draft:false,prerelease:false}))" "$TMP"
api POST "https://api.github.com/repos/$OWNER/$REPO/releases" "$TMP" application/json > "$TMP.r"
RID=$(node -p "const r=JSON.parse(require('fs').readFileSync('$TMP.r','utf8')); if(!r.id){console.error(JSON.stringify(r));process.exit(1)} r.id")
URL=$(node -p "JSON.parse(require('fs').readFileSync('$TMP.r','utf8')).html_url")
for f in "$EXE" "$EXE.blockmap" "$EXE.sha256" release/latest.yml; do
  n=$(basename "$f"); echo "   uploading $n"
  api POST "https://uploads.github.com/repos/$OWNER/$REPO/releases/$RID/assets?name=$n" "$f" application/octet-stream > "$TMP.r"
  node -e "const r=JSON.parse(require('fs').readFileSync('$TMP.r','utf8')); if(r.state!=='uploaded'){console.error(JSON.stringify(r));process.exit(1)}"
done
rm -f "$TMP" "$TMP.r"
echo "== published $URL"
