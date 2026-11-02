#!/bin/sh
# One-command release:   sh tools/release.sh 2.5.0 "What's new, for players"   [--dry-run]
#  1. sets the version in electron/package.json      2. builds everything (tools/package.sh)
#  3. splits the installer into parts                4. commits + pushes the source to GitHub (main)
#  5. creates GitHub Release v<version> and uploads: Setup exe, latest.yml, .blockmap, .sha256
#   sh tools/release.sh 2.4.0 "notes" --publish-only   uploads the already-built files in release/ (no rebuild)
# Installed games (v2.4.0+) see the new release on their next launch and offer to update.
# Needs env GH_TOKEN (fine-grained, Contents read/write on delishyp/Dungeon-Delve). The token is only ever
# passed to curl/git through stdin/env — never on a command line, never written to a file, never printed.
set -e
cd "$(dirname "$0")/.."
OWNER=delishyp; REPO=Dungeon-Delve
V="$1"; NOTES="$2"; DRY=""; ONLY=""; [ "$3" = "--dry-run" ] && DRY=1; [ "$3" = "--publish-only" ] && ONLY=1   # --publish-only: upload what is already in release/
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "usage: sh tools/release.sh X.Y.Z \"notes\" [--dry-run]"; exit 1; }
[ -n "$NOTES" ] || { echo "please give short release notes"; exit 1; }
[ -n "$DRY" ] || test -n "$GH_TOKEN" || { echo "GH_TOKEN is not set"; exit 1; }
set +x
CUR=$(node -p "require('./electron/package.json').version")
echo "== Dungeon Delve $CUR -> $V"
if [ -z "$ONLY" ]; then
  node -e "const f='electron/package.json',j=require('./'+f);j.version='$V';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
  sh tools/package.sh
  sh tools/split-parts.sh "$V"
fi
EXE="release/DungeonDelve-Setup-$V.exe"
for f in "$EXE" "$EXE.blockmap" "$EXE.sha256" release/latest.yml; do test -s "$f" || { echo "missing $f"; exit 1; }; done
grep -q "^version: $V$" release/latest.yml
if [ -n "$DRY" ]; then echo "== dry run: built $EXE, nothing published"; exit 0; fi

api() {  # api METHOD URL [datafile] [content-type]   (auth header goes to curl via stdin config, not argv)
  printf 'header = "Authorization: Bearer %s"\n' "$GH_TOKEN" | curl -sS -K - -X "$1" "$2" \
    -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
    ${3:+--data-binary @"$3"} ${4:+-H "Content-Type: $4"}
}
# -- source to main (the release tag points at it). git gets the token from env via a credential helper.
[ -d .git ] || { git init -q -b main; git remote add origin "https://github.com/$OWNER/$REPO.git"; }
git add -A && (git diff --cached --quiet || git -c user.name="Dungeon Delve" -c user.email="dungeon-delve@users.noreply.github.com" commit -qm "Release v$V")
git grep -n "github_pat_\|ghp_" -- . >/dev/null 2>&1 && { echo "token-like string in repo, aborting"; exit 1; } || true
git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' push -q origin main
# -- release
TMP=$(mktemp); trap 'rm -f "$TMP" "$TMP.r"' EXIT
NOTES="$NOTES" V="$V" node -e "require('fs').writeFileSync(process.argv[1],JSON.stringify({tag_name:'v'+process.env.V,target_commitish:'main',name:'Dungeon Delve v'+process.env.V,body:process.env.NOTES,draft:false,prerelease:false}))" "$TMP"
api POST "https://api.github.com/repos/$OWNER/$REPO/releases" "$TMP" application/json > "$TMP.r"
RID=$(node -p "const r=JSON.parse(require('fs').readFileSync('$TMP.r','utf8')); if(!r.id){console.error(JSON.stringify(r));process.exit(1)} r.id")
URL=$(node -p "JSON.parse(require('fs').readFileSync('$TMP.r','utf8')).html_url")
for f in "$EXE" "$EXE.blockmap" "$EXE.sha256" release/latest.yml; do
  n=$(basename "$f"); echo "   uploading $n"
  api POST "https://uploads.github.com/repos/$OWNER/$REPO/releases/$RID/assets?name=$n" "$f" application/octet-stream > "$TMP.r"
  node -e "const r=JSON.parse(require('fs').readFileSync('$TMP.r','utf8')); if(r.state!=='uploaded'){console.error(JSON.stringify(r));process.exit(1)}"
done
echo "== published $URL"
