/**
 * Production safety audit for Neopets Reminders.
 * Scans production source and built dist for forbidden APIs, permissions, and hosts.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function rel(p) {
  return relative(root, p);
}

const TEXT_EXTS = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.json',
  '.map',
]);

function readText(p) {
  if (!TEXT_EXTS.has(extname(p))) return null;
  return readFileSync(p, 'utf8');
}

// --- Production source files (exclude tests, planning docs, scaffolds) ---
const prodSourceDirs = [join(root, 'src'), join(root, 'manifest.json')];
const prodSources = [];
for (const entry of prodSourceDirs) {
  if (!existsSync(entry)) continue;
  const st = statSync(entry);
  if (st.isDirectory()) walk(entry, prodSources);
  else prodSources.push(entry);
}

const distDir = join(root, 'dist');
const distFiles = walk(distDir);

// Forbidden patterns in production JS/TS (not HTML comments about policy)
const FORBIDDEN_CODE = [
  { name: 'fetch(', re: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', re: /\bWebSocket\b/ },
  { name: 'EventSource', re: /\bEventSource\b/ },
  { name: 'location.reload', re: /\blocation\.reload\s*\(/ },
  { name: 'form.submit', re: /\.submit\s*\(/ },
  { name: 'requestSubmit', re: /\brequestSubmit\s*\(/ },
  { name: 'chrome.webRequest', re: /chrome\.webRequest\b/ },
  { name: 'chrome.declarativeNetRequest', re: /chrome\.declarativeNetRequest\b/ },
  { name: 'chrome.cookies', re: /chrome\.cookies\b/ },
];

// Content script must not programmatically click DOM
const CONTENT_CLICK = /\.click\s*\(/;

// Remote script URLs
const REMOTE_SCRIPT = /https?:\/\/[^"'`\s]+\.js\b/i;

// Unexpected external hosts in production code (allow only www.neopets.com in URL constants)
const ALLOWED_HOST_SNIPPETS = [
  'www.neopets.com',
  'chrome-extension://',
  'chrome.runtime',
  'chrome.storage',
  'chrome.alarms',
  'chrome.notifications',
  'chrome.tabs',
  'chrome.runtime',
];

function scanFile(path, isContentScript) {
  const text = readText(path);
  if (text == null) return;
  const r = rel(path);
  // Skip source maps for most pattern checks except remote URLs
  const isMap = path.endsWith('.map');

  if (!isMap) {
    for (const rule of FORBIDDEN_CODE) {
      if (rule.re.test(text)) {
        // Allow .submit only if it's clearly not form — still fail per policy
        failures.push(`${r}: forbidden ${rule.name}`);
      }
    }
    if (isContentScript && CONTENT_CLICK.test(text)) {
      failures.push(`${r}: content-script DOM .click() is forbidden`);
    }
  }

  if (REMOTE_SCRIPT.test(text) && !r.includes('safety-audit')) {
    // Ignore sourcemap source path references that aren't actual remote loads
    if (!isMap || /src=["']https?:\/\//.test(text)) {
      const matches = text.match(/https?:\/\/[^"'`\s]+\.js\b/gi) || [];
      for (const m of matches) {
        if (!m.includes('www.neopets.com')) {
          failures.push(`${r}: remote script URL ${m}`);
        }
      }
    }
  }
}

for (const p of prodSources) {
  const isContent = p.includes(`${join('src', 'content')}`) || p.endsWith('training.ts') && p.includes('content');
  scanFile(p, /[/\\]content[/\\]/.test(p));
}

for (const p of distFiles) {
  const isContent =
    p.includes('training-content') || p.includes('observe-content');
  scanFile(p, isContent);
}

// chrome.tabs.create only allowed in reviewed navigation handler (service worker)
const tabsCreateFiles = [...prodSources, ...distFiles].filter((p) => {
  const t = readText(p);
  return t && /\bchrome\.tabs\.create\b/.test(t);
});
for (const p of tabsCreateFiles) {
  const r = rel(p);
  const ok =
    r.includes('service-worker') ||
    r.includes('notifications') ||
    r.includes('background/');
  if (!ok) {
    failures.push(`${r}: chrome.tabs.create only allowed in service-worker navigation path`);
  }
}

// Manifest checks
const manifestPaths = [
  join(root, 'manifest.json'),
  join(distDir, 'manifest.json'),
].filter(existsSync);

const ALLOWED_PERMS = new Set(['storage', 'alarms', 'notifications']);
const ALLOWED_MATCHES = new Set([
  'https://www.neopets.com/pirates/academy.phtml*',
  'https://www.neopets.com/island/training.phtml*',
  'https://www.neopets.com/island/fight_training.phtml*',
  'https://www.neopets.com/hospital/volunteer.phtml*',
  'https://www.neopets.com/halloween/gravedanger/*',
  'https://www.neopets.com/faerieland/springs.phtml*',
  'https://www.neopets.com/desert/shrine.phtml*',
  'https://www.neopets.com/moon/meteor.phtml*',
  'https://ncmall.neopets.com/mall/shop.phtml*',
]);
const FORBIDDEN_PERMS = [
  'cookies',
  'webRequest',
  'declarativeNetRequest',
  'history',
  'downloads',
  'tabs',
  'scripting',
  'activeTab',
  'host_permissions',
];

for (const mp of manifestPaths) {
  const m = JSON.parse(readFileSync(mp, 'utf8'));
  const r = rel(mp);
  const perms = m.permissions || [];
  for (const p of perms) {
    if (!ALLOWED_PERMS.has(p)) {
      failures.push(`${r}: unexpected permission "${p}"`);
    }
  }
  for (const fp of FORBIDDEN_PERMS) {
    if (perms.includes(fp)) {
      failures.push(`${r}: forbidden permission "${fp}"`);
    }
  }
  if (m.host_permissions && m.host_permissions.length) {
    failures.push(`${r}: host_permissions must be empty/absent in Phase 1`);
  }
  const matches = (m.content_scripts || []).flatMap((cs) => cs.matches || []);
  for (const match of matches) {
    if (match === '<all_urls>') {
      failures.push(`${r}: <all_urls> is forbidden`);
    }
    if (!ALLOWED_MATCHES.has(match)) {
      failures.push(`${r}: unexpected content_scripts match "${match}"`);
    }
  }
  for (const expected of ALLOWED_MATCHES) {
    if (!matches.includes(expected)) {
      failures.push(`${r}: missing required match "${expected}"`);
    }
  }
  if (JSON.stringify(m).includes('<all_urls>')) {
    failures.push(`${r}: contains <all_urls>`);
  }
}

// Unexpected hosts in src (string literals)
const HOST_RE = /https?:\/\/([a-zA-Z0-9.-]+)/g;
for (const p of [...prodSources, ...distFiles.filter((f) => !f.endsWith('.map'))]) {
  const text = readText(p);
  if (!text) continue;
  let match;
  while ((match = HOST_RE.exec(text)) !== null) {
    const host = match[1];
    if (host === 'www.neopets.com') continue;
    if (host === 'ncmall.neopets.com') continue;
    // ignore localhost in sourcemaps etc
    if (host === 'localhost' || host.startsWith('127.')) continue;
    failures.push(`${rel(p)}: unexpected host ${host}`);
  }
}

if (failures.length) {
  console.error('Safety audit FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('Safety audit passed.');
console.log(`  Scanned ${prodSources.length} production source files`);
console.log(`  Scanned ${distFiles.length} dist files`);
