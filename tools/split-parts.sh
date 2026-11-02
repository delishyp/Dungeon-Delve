#!/bin/sh
# sh tools/split-parts.sh 2.4.0  -> release/parts-2.4.0/ : installer in <19 MB parts + join.cmd + sha256 files
set -e
cd "$(dirname "$0")/.."
V="$1"; EXE="DungeonDelve-Setup-$V.exe"; D="release/parts-$V"
test -f "release/$EXE"
rm -rf "$D"; mkdir -p "$D"
split -b 18000000 -d -a 2 "release/$EXE" "$D/$EXE.part"
SUM=$(sha256sum "release/$EXE" | cut -d' ' -f1); UP=$(echo "$SUM" | tr a-f A-F)
echo "$SUM  $EXE" > "$D/$EXE.sha256"
(cd "$D" && sha256sum "$EXE".part?? > parts.sha256)
LIST=$(cd "$D" && ls "$EXE".part?? | tr '\n' '+' | sed 's/+$//'); N=$(ls "$D/$EXE".part?? | wc -l)
printf '@echo off\r\ncd /d "%%~dp0"\r\ncopy /b %s %s\r\npowershell -NoProfile -Command "(Get-FileHash %s -Algorithm SHA256).Hash"\r\necho Expected: %s\r\npause\r\n' "$LIST" "$EXE" "$EXE" "$UP" > "$D/join.cmd"
printf 'Rebuild the installer from the %s parts (put all files in one folder first):\r\n\r\nCommand Prompt (cmd):\r\n  copy /b %s %s\r\n\r\nCheck it (PowerShell):\r\n  Get-FileHash %s -Algorithm SHA256\r\n  -> must be %s\r\n\r\nOr just double-click join.cmd in this folder.\r\n' "$N" "$LIST" "$EXE" "$EXE" "$UP" > "$D/JOIN-ON-WINDOWS.txt"
cat "$D"/part?? 2>/dev/null >/dev/null || true
test "$(cat "$D/$EXE".part?? | sha256sum | cut -d' ' -f1)" = "$SUM" && echo "parts OK: $N parts, sha256 $SUM"
