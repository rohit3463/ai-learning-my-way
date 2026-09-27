// Runs learner code in Python (Pyodide) off the main thread, so a runaway loop can be stopped.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');

const HARNESS = `
import sys, io, json, traceback

def close(a, b, tol=1e-2):
    """True when two numbers are within tol of each other."""
    return abs(a - b) <= tol

def _where(e, fname):
    line = None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == fname:
            line = f.lineno
    return {'type': type(e).__name__, 'msg': str(e), 'line': line}

def _run(src, tests_json):
    tests = json.loads(tests_json)
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    ns = {'close': close, '__name__': '__main__'}
    res = {'stage': 'ok', 'tests': [], 'stdout': ''}
    try:
        try:
            exec(compile(src, 'your_code.py', 'exec'), ns)
        except SyntaxError as e:
            res['stage'] = 'code'
            res['error'] = {'type': 'SyntaxError', 'msg': e.msg, 'line': e.lineno}
        except Exception as e:
            res['stage'] = 'code'
            res['error'] = _where(e, 'your_code.py')
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

function importsIn(code) {
  const found = new Set();
  for (const m of code.matchAll(/^\s*(?:from|import)\s+([A-Za-z_]\w*)/gm)) if (LIBS[m[1]]) found.add(m[1]);
  return [...found];
}

onmessage = async (e) => {
  await ready;
  const { id, src, tests } = e.data;
  try {
    const code = src + '\n' + tests.map(t => t.check).join('\n');
    const missing = importsIn(code).filter(n => !installed.has(n));
    if (missing.length) {
      postMessage({ type: 'installing', id, names: missing.map(n => LIBS[n]) });
      await py.loadPackagesFromImports(code);
      missing.forEach(n => installed.add(n));
      postMessage({ type: 'installed', id });
    }
    py.globals.set('_src', src);
    py.globals.set('_tests_json', JSON.stringify(tests));
    const out = py.runPython('_run(_src, _tests_json)');
    postMessage({ type: 'result', id, result: JSON.parse(out) });
  } catch (err) {
    postMessage({ type: 'result', id, result: { fatal: String(err) } });
  }
};
