#!/usr/bin/env node
// Scaffold a guidelines plugin into a marketplace and register it.
// This is the ONLY approved way to emit a guidelines plugin — never hand-write
// the files, and never drop a bare SKILL.md into a skills dir.
//
// Plugin name and skill name are SEPARATE:
//   --plugin is the plugin folder + plugin.json + marketplace entry name.
//   --skill  is the skill name (must end in "-guidelines" — the coder resolves
//            the guideline by that suffix). It names skills/<skill>/.
//
// Usage:
//   node scaffold.mjs --plugin react-frontend --skill react-guidelines \
//     --dest <marketplace-root> --description "<invoke-before-writing description>" \
//     --body <path-to-SKILL.md-body>
//   Flags accept both `--flag value` and `--flag=value`.
//   Optional:
//     --market-name <name> --owner <owner>  (only when <dest> has no marketplace.json yet)
//     --force                               (overwrite an existing plugin of the same name)
//     --ref <name>=<path>                   (repeatable) copy <path> into
//                                           skills/<skill>/references/<name>. <name>
//                                           may include subdirs, e.g. db/postgres.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const BOOLEANS = new Set(['force']);
const REPEATED = new Set(['ref']); // collected into an array

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// Accepts `--flag value` and `--flag=value`; flags in BOOLEANS take no value.
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) fail(`Expected a --flag but got "${tok}".`);
    const eq = tok.indexOf('=');
    const key = tok.slice(2, eq === -1 ? undefined : eq);
    if (BOOLEANS.has(key)) {
      a[key] = eq === -1 ? true : tok.slice(eq + 1) !== 'false';
      continue;
    }
    let val;
    if (eq !== -1) {
      val = tok.slice(eq + 1);
    } else {
      val = argv[i + 1];
      // ponytail: a value that itself starts with `--` must use the --flag=value form.
      if (val === undefined || val.startsWith('--')) fail(`Flag "${tok}" needs a value.`);
      i++;
    }
    if (REPEATED.has(key)) (a[key] ??= []).push(val);
    else a[key] = val;
  }
  return a;
}

const a = parseArgs(process.argv.slice(2));
const missing = ['plugin', 'skill', 'dest', 'description', 'body'].filter((k) => !a[k]);
if (missing.length) {
  console.error(`Missing required flag(s): ${missing.map((m) => '--' + m).join(', ')}`);
  console.error('  --plugin is the plugin name; --skill is the skill name (must end in -guidelines).');
  console.error('  --dest is the marketplace root the user pointed you at (ask them first).');
  process.exit(1);
}
if (!/-guidelines$/.test(a.skill)) fail(`--skill must end with "-guidelines" (got "${a.skill}").`);
if (!existsSync(a.dest)) fail(`--dest directory does not exist: ${a.dest}`);
if (!existsSync(a.body)) fail(`--body file not found: ${a.body}`);

const marketFile = join(a.dest, '.claude-plugin', 'marketplace.json');
let market;
if (existsSync(marketFile)) {
  try {
    market = JSON.parse(readFileSync(marketFile, 'utf8'));
  } catch (e) {
    fail(`Marketplace file is not valid JSON: ${marketFile}\n  ${e.message}`);
  }
} else {
  if (!a['market-name'] || !a.owner) {
    fail(`No marketplace at ${marketFile}. To create one, also pass --market-name and --owner.`);
  }
  market = { name: a['market-name'], owner: { name: a.owner }, plugins: [] };
}
market.plugins ??= [];

// Refuse to clobber an existing plugin — checking BOTH the marketplace entry and
// the plugin dir on disk — unless --force is given.
const pluginDir = join(a.dest, a.plugin);
const inMarket = market.plugins.some((p) => p.name === a.plugin);
const onDisk = existsSync(pluginDir);
if ((inMarket || onDisk) && !a.force) {
  const where = [onDisk && `on disk (${pluginDir})`, inMarket && 'in the marketplace'].filter(Boolean).join(' and ');
  console.error(`Plugin "${a.plugin}" already exists ${where}. Re-run with --force to overwrite, or choose a different --plugin name.`);
  process.exit(2);
}

// Plugin files.
mkdirSync(join(pluginDir, '.claude-plugin'), { recursive: true });
const skillDir = join(pluginDir, 'skills', a.skill);
mkdirSync(skillDir, { recursive: true });

writeFileSync(
  join(pluginDir, '.claude-plugin', 'plugin.json'),
  JSON.stringify({ name: a.plugin, description: a.description, version: '1.0.0' }, null, 2) + '\n',
);
writeFileSync(join(skillDir, 'SKILL.md'), readFileSync(a.body, 'utf8'));

// Reference files → skills/<skill>/references/<name>.
const refPaths = [];
for (const spec of a.ref ?? []) {
  const eq = spec.indexOf('=');
  if (eq === -1) fail(`--ref must be <name>=<path> (got "${spec}").`);
  const name = spec.slice(0, eq);
  const src = spec.slice(eq + 1);
  if (!name || !src) fail(`--ref must be <name>=<path> (got "${spec}").`);
  if (name.startsWith('/') || name.includes('..')) fail(`--ref name must be a relative path inside references/ (got "${name}").`);
  if (!existsSync(src)) fail(`--ref source not found: ${src}`);
  const out = join(skillDir, 'references', name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, readFileSync(src, 'utf8'));
  refPaths.push(out);
}

// Register in the marketplace — replace any existing entry so --force updates
// the record instead of duplicating it.
market.plugins = market.plugins.filter((p) => p.name !== a.plugin);
market.plugins.push({ name: a.plugin, source: `./${a.plugin}`, description: a.description });
mkdirSync(dirname(marketFile), { recursive: true });
writeFileSync(marketFile, JSON.stringify(market, null, 2) + '\n');

console.log(`Plugin created:   ${pluginDir}`);
console.log(`SKILL.md:         ${join(skillDir, 'SKILL.md')}`);
for (const r of refPaths) console.log(`Reference:        ${r}`);
console.log(`Registered in:    ${marketFile}`);
