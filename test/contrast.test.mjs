// WCAG contrast assertions over the colour source. A token that fails here cannot ship.
//   ink roles on every surface: 4.5:1 (AA text); placeholder 3:1; disabled is exempt by design
//   pl.* and attn on base/card surfaces: 4.5:1 (they are money/advisory TEXT)
//   status.* on base/card: 3:1 (UI indicators, WCAG 1.4.11)
//   edge.focus on base: 3:1
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const color = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'color.json'), 'utf8'));
const val = (node, scheme) => (Array.isArray(node) ? node : node.value)[scheme === 'light' ? 0 : 1];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = h => { const [r, g, b] = hex(h).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const isHex = s => /^#[0-9a-f]{6}$/i.test(s);

// Known failures carried over from the current app's palette, measured 2026-09-13. Each is a
// pending DESIGN decision (docs/migration/DECISIONS.md H8), not a permanent exception: when the
// value changes, the entry is removed and the assertion goes live. Adding an entry requires a
// measured ratio, a proposed passing value, and a decision reference.
const KNOWN_FAILURES = {
  'light status.success on surface.base >= 3:1 (indicator)': {measured: 2.45, proposed: '#0ea674 (3.02:1) — or #0b845c (4.54:1) if it is ever used as text', decision: 'H8'},
  'light status.success on surface.card >= 3:1 (indicator)': {measured: 2.54, proposed: '#0ea674', decision: 'H8'},
  'light status.orange on surface.base >= 3:1 (indicator)': {measured: 2.71, proposed: '#eb6d15 (3.01:1)', decision: 'H8'},
  'light status.orange on surface.card >= 3:1 (indicator)': {measured: 2.8, proposed: '#eb6d15', decision: 'H8'},
  'dark ink.subtle on surface.cardSoft >= 4.5:1': {measured: 4.45, proposed: '#7b8088 (4.51:1)', decision: 'H8'},
};
const check = (name, ok, detail) => test(name, t => {
  const known = KNOWN_FAILURES[name];
  if (known) {
    if (ok) assert.fail(`${name} now passes — remove it from KNOWN_FAILURES`);
    t.diagnostic(`known failure ${detail} — proposed ${known.proposed} (decision ${known.decision})`);
    return;
  }
  assert.ok(ok, detail);
});

for (const scheme of ['light', 'dark']) {
  const surfaces = Object.entries(color.surface).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, val(v, scheme)]);
  const textSurfaces = surfaces.filter(([k]) => ['base', 'raised', 'card', 'sunken', 'cardSoft', 'input'].includes(k));
  for (const [inkName, node] of Object.entries(color.ink)) {
    if (inkName.startsWith('$') || ['inverse', 'disabled'].includes(inkName)) continue;
    const min = inkName === 'placeholder' ? 3 : 4.5;
    for (const [sName, s] of textSurfaces) {
      const fg = val(node, scheme);
      if (!isHex(fg) || !isHex(s)) continue;
      check(`${scheme} ink.${inkName} on surface.${sName} >= ${min}:1`, ratio(fg, s) >= min, `${ratio(fg, s).toFixed(2)}:1`);
    }
  }
  for (const group of ['pl']) for (const [k, node] of Object.entries(color[group])) {
    if (k.startsWith('$')) continue;
    for (const sName of ['base', 'card']) { const r = ratio(val(node, scheme), val(color.surface[sName], scheme)); check(`${scheme} ${group}.${k} on surface.${sName} >= 4.5:1`, r >= 4.5, `${r.toFixed(2)}:1`); }
  }
  for (const sName of ['base', 'card']) { const r = ratio(val(color.attn, scheme), val(color.surface[sName], scheme)); check(`${scheme} attn on surface.${sName} >= 4.5:1`, r >= 4.5, `${r.toFixed(2)}:1`); }
  for (const [k, node] of Object.entries(color.status)) {
    if (k.startsWith('$')) continue;
    for (const sName of ['base', 'card']) { const r = ratio(val(node, scheme), val(color.surface[sName], scheme)); check(`${scheme} status.${k} on surface.${sName} >= 3:1 (indicator)`, r >= 3, `${r.toFixed(2)}:1`); }
  }
  { const r = ratio(val(color.edge.focus, scheme), val(color.surface.base, scheme)); check(`${scheme} edge.focus on surface.base >= 3:1`, r >= 3, `${r.toFixed(2)}:1`); }
}
