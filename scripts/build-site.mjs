// Builds dist/ for GitHub Pages: copies site/, writes config.js and selecta.js with the public Supabase settings.
// The anon key is meant to be public (it only allows what the database rules allow).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'dist');
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_ANON_KEY || '';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'app.css', 'app.js', 'ad-render.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));

fs.writeFileSync(path.join(OUT, 'config.js'),
  `window.SELECTA_CONFIG = ${JSON.stringify({ supabaseUrl: url || '__NOT_SET__', supabaseAnonKey: key })};\n`);

const snippet = fs.readFileSync(path.join(SRC, 'ad-render.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(SRC, 'selecta.src.js'), 'utf8')
    .replace('__SUPABASE_URL__', url || '__SUPABASE_URL__')
    .replace('__SUPABASE_ANON_KEY__', key || '__SUPABASE_ANON_KEY__');
fs.writeFileSync(path.join(OUT, 'selecta.js'), snippet);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(url ? 'Built dist/ with Supabase settings.' : 'Built dist/ in demo mode (no Supabase settings).');
