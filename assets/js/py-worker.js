// Runs learner code in Python (Pyodide) off the main thread, so a runaway loop can be stopped.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');

const HARNESS = `
import sys, io, json, traceback

def close(a, b, tol=1e-2):
    """True when two numbers are within tol of each other."""
    return abs(a - b) <= tol

import os

def _where(e, fname):
    line, file = None, None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == fname or (fname is None and f.filename.startswith(_PROJ)):
            line, file = f.lineno, os.path.basename(f.filename)
    return {'type': type(e).__name__, 'msg': str(e), 'line': line, 'file': file}

_PROJ = '/home/pyodide/project/'

def _fresh(real_key=None):
    """Every run starts from a clean simulated model and clock."""
    if real_key:
        import anthropic   # so the key is in place before your code makes a client
    if 'llmsim' in sys.modules:
        sys.modules['llmsim'].reset()
    if 'anthropic' in sys.modules:
        a = sys.modules['anthropic']
        a._cache.clear()
        a._REAL = {'key': real_key} if real_key else None

def _run(src, tests_json, real_key=None, files_json=None):
    tests = json.loads(tests_json)
    files = json.loads(files_json) if files_json else None
    _fresh(real_key)
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    ns = {'close': close, '__name__': '__main__'}
    res = {'stage': 'ok', 'tests': [], 'stdout': ''}
    try:
        try:
            if files is None:
                exec(compile(src, 'your_code.py', 'exec'), ns)
            else:
                _load_project(files)
        except SyntaxError as e:
            res['stage'] = 'code'
            res['error'] = {'type': 'SyntaxError', 'msg': e.msg, 'line': e.lineno,
                            'file': os.path.basename(e.filename) if files is not None and e.filename else None}
        except Exception as e:
            res['stage'] = 'code'
            res['error'] = _where(e, 'your_code.py' if files is None else None)
        if res['stage'] == 'ok':
            for t in tests:
                try:
                    exec(compile(t['check'], 'test', 'exec'), ns)
                    res['tests'].append({'name': t['name'], 'ok': True})
                except AssertionError as e:
                    res['tests'].append({'name': t['name'], 'ok': False, 'msg': str(e) or 'The check did not pass.'})
                except Exception as e:
                    res['tests'].append({'name': t['name'], 'ok': False, 'msg': type(e).__name__ + ': ' + str(e)})
    finally:
        sys.stdout = old
    res['stdout'] = buf.getvalue()[-4000:]
    return json.dumps(res)

def _load_project(files):
    """Write the project's files to disk and import each Python module once, fresh."""
    import importlib, shutil
    os.chdir(os.path.dirname(_PROJ.rstrip('/')))   # step out before clearing the folder
    if os.path.isdir(_PROJ):
        shutil.rmtree(_PROJ)
    os.makedirs(_PROJ)
    for name, text in files.items():
        with open(_PROJ + name, 'w') as f:
            f.write(text)
    for mod in [m for m, v in list(sys.modules.items()) if (getattr(v, '__file__', '') or '').startswith(_PROJ)]:
        del sys.modules[mod]
    if _PROJ not in sys.path:
        sys.path.insert(0, _PROJ)
    os.chdir(_PROJ)
    importlib.invalidate_caches()
    for name in files:
        if name.endswith('.py'):
            importlib.import_module(name[:-3])

def _install_sim(sources):
    """Put llmsim and the anthropic stand-in where import can find them, and use the pretend clock."""
    import time
    root = '/home/pyodide/simlib/'
    for name, text in json.loads(sources).items():
        path = root + name
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(text)
    if root not in sys.path:
        sys.path.insert(0, root)
    import llmsim
    start = time.time()
    time.sleep = llmsim.clock.sleep
    time.time = lambda: start + llmsim.clock.now()
    time.monotonic = time.perf_counter = lambda: llmsim.clock.now()
`;

let py = null;
const ready = (async () => {
  py = await loadPyodide();
  py.runPython(HARNESS);
  postMessage({ type: 'ready' });
})().catch(err => postMessage({ type: 'fatal', error: String(err) }));

// Libraries fetched on first import. Pyodide maps each import name to its package (sklearn -> scikit-learn).
const LIBS = { numpy: 'numpy', sklearn: 'scikit-learn', scipy: 'scipy', pandas: 'pandas' };
const installed = new Set();

// The simulated model, installed the first time code imports anthropic or llmsim.
const SIM = ['anthropic', 'llmsim'];
const SIM_FILES = { 'llmsim.py': 'llmsim.py', 'anthropic/__init__.py': 'anthropic/__init__.py' };
let simReady = null;
function installSim() {
  return simReady || (simReady = (async () => {
    const base = new URL('../py/', self.location.href);
    const out = {};
    for (const [dest, src] of Object.entries(SIM_FILES)) {
      const r = await fetch(new URL(src + '?v=' + SIM_VERSION, base));
      if (!r.ok) throw new Error('Could not load the simulated model (' + src + ')');
      out[dest] = await r.text();
    }
    py.globals.set('_sim_sources', JSON.stringify(out));
    py.runPython('_install_sim(_sim_sources)');
  })());
}
const SIM_VERSION = 1;

function importsIn(code, table = LIBS) {
  const found = new Set();
  for (const m of code.matchAll(/^\s*(?:from|import)\s+([A-Za-z_]\w*)/gm)) if (table === LIBS ? LIBS[m[1]] : table.includes(m[1])) found.add(m[1]);
  return [...found];
}

onmessage = async (e) => {
  await ready;
  const { id, src, tests, files, realKey } = e.data;
  try {
    const code = (files ? Object.values(files).join('\n') : src) + '\n' + tests.map(t => t.check).join('\n');
    if (importsIn(code, SIM).length) await installSim();
    const missing = importsIn(code).filter(n => !installed.has(n));
    if (missing.length) {
      postMessage({ type: 'installing', id, names: missing.map(n => LIBS[n]) });
      await py.loadPackagesFromImports(code);
      missing.forEach(n => installed.add(n));
      postMessage({ type: 'installed', id });
    }
    py.globals.set('_src', src || '');
    py.globals.set('_tests_json', JSON.stringify(tests));
    py.globals.set('_real_key', realKey || null);
    py.globals.set('_files_json', files ? JSON.stringify(files) : null);
    const out = py.runPython('_run(_src, _tests_json, _real_key, _files_json)');
    py.globals.set('_real_key', null);
    postMessage({ type: 'result', id, result: JSON.parse(out) });
  } catch (err) {
    postMessage({ type: 'result', id, result: { fatal: String(err) } });
  }
};
