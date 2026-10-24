import { execFileSync } from 'node:child_process';

const apk = process.argv[2];
if (!apk) {
  console.error('usage: npm run check:apk -- <path-to.apk> [--expect-no-internet]');
  process.exit(2);
}

const manifest = execFileSync('unzip', ['-p', apk, 'AndroidManifest.xml'], {
  maxBuffer: 64 * 1024 * 1024,
});

function readStringPool(buf, off) {
  const count = buf.readUInt32LE(off + 8);
  const flags = buf.readUInt32LE(off + 16);
  const stringsStart = buf.readUInt32LE(off + 20);
  const utf8 = (flags & 0x100) !== 0;
  const strings = [];
  for (let i = 0; i < count; i++) {
    let p = off + stringsStart + buf.readUInt32LE(off + 28 + 4 * i);
    if (utf8) {
      const len = buf[p++];
      if (len & 0x80) p++;
      let blen = buf[p++];
      if (blen & 0x80) blen = ((blen & 0x7f) << 8) | buf[p++];
      strings.push(buf.toString('utf8', p, p + blen));
    } else {
      let len = buf.readUInt16LE(p);
      p += 2;
      if (len & 0x8000) {
        len = ((len & 0x7fff) << 16) | buf.readUInt16LE(p);
        p += 2;
      }
      strings.push(buf.toString('utf16le', p, p + len * 2));
    }
  }
  return strings;
}

function usesPermissions(buf) {
  const found = [];
  let strings = [];
  let off = buf.readUInt16LE(2);
  while (off < buf.length) {
    const type = buf.readUInt16LE(off);
    const size = buf.readUInt32LE(off + 4);
    if (type === 0x0001) strings = readStringPool(buf, off);
    if (type === 0x0102) {
      const tag = strings[buf.readUInt32LE(off + 20)];
      if (tag === 'uses-permission' || tag === 'uses-permission-sdk-23') {
        const attrStart = off + 16 + buf.readUInt16LE(off + 24);
        const attrSize = buf.readUInt16LE(off + 26);
        const attrCount = buf.readUInt16LE(off + 28);
        for (let i = 0; i < attrCount; i++) {
          const a = attrStart + i * attrSize;
          if (strings[buf.readUInt32LE(a + 4)] !== 'name') continue;
          const raw = buf.readInt32LE(a + 8);
          found.push(raw >= 0 ? strings[raw] : strings[buf.readUInt32LE(a + 16)]);
        }
      }
    }
    if (size === 0) break;
    off += size;
  }
  return found;
}

const permissions = usesPermissions(manifest);
for (const p of permissions) console.log(p);

if (process.argv.includes('--expect-no-internet')) {
  if (permissions.includes('android.permission.INTERNET')) {
    console.error('FAIL: the APK requests android.permission.INTERNET');
    process.exit(1);
  }
  console.error('OK: no android.permission.INTERNET');
}
