// Check a coding lab in local Python: every step's solution must pass its tests and every starter must fail.
// usage: node tools/check-lab.mjs <slug> [--skip id,id]   (run from the repo root; needs python3)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const slug = process.argv[2];
const skip = (process.argv.includes('--skip') ? process.argv[process.argv.indexOf('--skip') + 1] : '').split(',').filter(Boolean);
globalThis.window = {};
await import(path.resolve('content/labs', slug + '.js'));
const steps = window.LABS[slug].steps.filter(s => !skip.includes(s.id));
const worker = fs.readFileSync('assets/js/py-worker.js', 'utf8');
const harness = worker.slice(worker.indexOf('`') + 1, worker.indexOf('`;'));
const py = harness + '\nimport json as J\nsteps = J.loads(' + JSON.stringify(JSON.stringify(steps)) + ')\n' + String.raw`
prev, bad = [], 0
for s in steps:
    for kind in ('starter', 'solution'):
        r = J.loads(_run('\n\n'.join(prev + [s[kind]]), J.dumps(s['tests'])))
        ok = r['stage'] == 'ok' and all(t['ok'] for t in r['tests'])
        if (kind == 'solution') != ok:
            bad += 1
            print('PROBLEM', s['id'], kind, r.get('error') or [t['name'] + ' -> ' + t.get('msg', '') for t in r['tests'] if not t['ok']] or 'starter passed')
        if kind == 'solution' and s['id'] == 'use' and r['stdout']:
            print('  output:', r['stdout'].strip().replace(chr(10), ' | ')[-400:])
    prev.append(s['solution'])
print(len(steps), 'steps checked,', bad, 'problems')
`;
const f = path.join(os.tmpdir(), `check-${slug}.py`);
fs.writeFileSync(f, py);
process.stdout.write(execFileSync('python3', [f]).toString());
