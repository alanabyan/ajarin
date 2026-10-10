// Mencari semua src/**/*.test.ts lalu menjalankannya dengan `tsx --test`.
// Dibuat sendiri karena shell Windows (cmd) tidak memperluas pola glob seperti `src/**/*.test.ts`.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function cari(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cari(p);
    return e.name.endsWith('.test.ts') ? [p] : [];
  });
}

const berkas = cari(join(__dirname, '..', 'src'));
if (berkas.length === 0) {
  console.error('Tidak ada file *.test.ts di src/.');
  process.exit(1);
}

const hasil = spawnSync(process.execPath, [require.resolve('tsx/cli'), '--test', ...berkas], { stdio: 'inherit' });
process.exit(hasil.status ?? 1);
