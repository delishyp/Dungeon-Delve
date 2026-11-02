// Sets the d20 icon + version info on the Windows exe without wine (pure JS via resedit).
const path = require('path'), fs = require('fs');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const data = fs.readFileSync(exe);
  const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const ids = groups.length ? groups.map(g => g.id) : [1];
  for (const id of ids) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, 1033, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const v = ctx.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033); vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: 'Dungeon Delve', FileDescription: 'Dungeon Delve', CompanyName: 'Anna', LegalCopyright: 'Made by Anna', OriginalFilename: 'Dungeon Delve.exe', InternalName: 'Dungeon Delve' });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • afterPack: icon + version info set on', path.basename(exe));
};
