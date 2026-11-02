# Dungeon Delve

A D&D-flavoured deck-building roguelike (think Slay the Spire) made for friends.

## Play on Windows
1. Open **[Releases](https://github.com/delishyp/Dungeon-Delve/releases/latest)** and download `DungeonDelve-Setup-<version>.exe`.
2. Run it. Windows may show **"Windows protected your PC"** (SmartScreen), because the game isn't code-signed.
   Click **More info → Run anyway**.
3. It installs just for you (no admin needed) and adds a desktop shortcut.

The game checks for updates when it starts (and from **Settings → Data → Check for updates**).
Updating keeps your saved run and settings. They live in `%APPDATA%\Dungeon Delve`.

Ignore the `latest.yml` / `.blockmap` files on the release page; the updater uses them.

## Building (for the curious)
`node build.js` builds `index.html` (the game, playable in a browser). `sh tools/package.sh` builds the Windows app on Linux.
See `release/RELEASING.md` in the dev copy for publishing.
