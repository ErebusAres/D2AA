import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const constantsPath = resolve(root, 'src', 'utils', 'constants.ts');
const source = readFileSync(constantsPath, 'utf8');
const match = source.match(/export const APP_VERSION = '([^']+)'/);

if (!match) {
  throw new Error('APP_VERSION was not found in src/utils/constants.ts');
}

const next = nextVersion(match[1]);
writeFileSync(constantsPath, source.replace(match[0], `export const APP_VERSION = '${next}'`));
console.log(`APP_VERSION ${match[1]} -> ${next}`);

function nextVersion(value) {
  const trimmed = value.trim();
  const early = /^v\.(\d{2})$/.exec(trimmed);
  if (early) {
    const nextMinor = Number(early[1]) + 1;
    if (nextMinor <= 99) return `v.${String(nextMinor).padStart(2, '0')}`;
    return 'v1.00';
  }

  const stable = /^v(\d+)\.(\d{2})$/.exec(trimmed);
  if (!stable) {
    throw new Error(`Unsupported APP_VERSION format: ${value}`);
  }

  const major = Number(stable[1]);
  const minor = Number(stable[2]) + 1;
  if (minor <= 99) return `v${major}.${String(minor).padStart(2, '0')}`;
  return `v${major + 1}.00`;
}
