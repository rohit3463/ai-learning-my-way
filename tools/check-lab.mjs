// Check a coding lab in local Python: every step's and exercise's solution must pass its tests,
// and every starter must fail. Works for one-file labs and multi-file projects.
// usage: node tools/check-lab.mjs <slug> [--skip id,id] [--file path/to/lab.js]   (run from the repo root; needs python3)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const slug = process.argv[2];
const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : '';
const skip = arg('--skip').split(',').filter(Boolean);
globalThis.window = {};
await import(path.resolve(arg('--file') || path.join('content/labs', slug + '.js')));
const lab = window.LABS[slug];
const strip = s => ({ id: s.id, starter: s.starter, solution: s.solution, tests: s.tests, add: s.add, optional: !!s.optional,
  given: Array.isArray(s.given) ? s.given.map(id => lab.steps.find(x => x.id === id).solution).join('\n\n') : (s.given || '') });
const steps = lab.steps.filter(s => !skip.includes(s.id)).map(strip);
const exercises = (lab.exercises || []).filter(s => !skip.includes(s.id)).map(strip);
const worker = fs.readFileSync('assets/js/py-worker.js', 'utf8');
const harness = worker.slice(worker.indexOf('`') + 1, worker.indexOf('`;'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-'));
const py = harness + `
import json as J, sys as _sys, time as _time
_PROJ = ${JSON.stringify(tmp + '/proj/')}
_sys.path.insert(0, ${JSON.stringify(path.resolve('assets/py'))})
import llmsim as _llmsim
_time.sleep = _llmsim.clock.sleep
lab = J.load(open(${JSON.stringify(tmp + '/lab.json')}, encoding='utf8'))
` + String.raw`
bad = 0
def ok_of(r):
    return r['stage'] == 'ok' and all(t['ok'] for t in r['tests'])
def report(item, kind, r):
    global bad
    bad += 1
    print('PROBLEM', item['id'], kind, r.get('error') or [t['name'] + ' -> ' + t.get('msg', '') for t in r['tests'] if not t['ok']] or 'starter passed')

if lab['project']:
    files = dict(lab['files'])
    for it in lab['steps'] + lab['exercises']:
        cur = dict(files)
        for f, text in (it.get('add') or {}).items():
            cur[f] = (cur[f].rstrip() + '\n\n' if cur.get(f) else '') + text
        r = J.loads(_run('', J.dumps(it['tests']), None, J.dumps(cur)))
        if it['solution'] and ok_of(r): report(it, 'starter', r)   # steps with nothing to write only need to pass
        for f, text in it['solution'].items():
            cur[f] = text
        r = J.loads(_run('', J.dumps(it['tests']), None, J.dumps(cur)))
        if not ok_of(r): report(it, 'solution', r)
        if r['stdout'] and it in lab['steps'][-1:]:
            print('  output:', r['stdout'].strip().replace(chr(10), ' | ')[-400:])
        if it in lab['steps']:
            files = cur
else:
    prev = []
    for s in lab['steps']:
        for kind in ('starter', 'solution'):
            r = J.loads(_run('\n\n'.join(prev + [s[kind]]), J.dumps(s['tests'])))
            if (kind == 'solution') != ok_of(r): report(s, kind, r)
            if kind == 'solution' and s['id'] == 'use' and r['stdout']:
                print('  output:', r['stdout'].strip().replace(chr(10), ' | ')[-400:])
        prev.append(s['solution'])
    for e in lab['exercises']:
        for kind in ('starter', 'solution'):
            src = (e['given'] + '\n\n' if e['given'] else '') + e[kind]
            r = J.loads(_run(src, J.dumps(e['tests'])))
            if (kind == 'solution') != ok_of(r): report(e, kind, r)
print(len(lab['steps']), 'steps and', len(lab['exercises']), 'exercises checked,', bad, 'problems')
`;
fs.writeFileSync(path.join(tmp, 'lab.json'), JSON.stringify({ steps, exercises, project: lab.mode === 'project', files: lab.files || null }));
const f = path.join(tmp, `check-${slug}.py`);
fs.writeFileSync(f, py);
process.stdout.write(execFileSync('python3', [f]).toString());
