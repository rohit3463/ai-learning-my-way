"""llmsim: a small, deterministic stand-in for a large language model.

The labs run in your browser with no API key, so every model call goes to this simulator
instead of a real model. It answers through the same interface as the Anthropic Python SDK
(see the `anthropic` package next to it), so the code you write here is the code you would
ship. It is not clever, but it is predictable, and it can be told to misbehave on purpose:
rate limits, slow answers, broken JSON, refusals, prompt injection and more.

What it does, in order, for each request:
  1. Faults you switched on with configure() (rate limits, overload, timeouts, ...).
  2. Rules you registered with on() or script() for this lab.
  3. Prompt injection, if configure(injectable=True) and a message says "ignore previous instructions".
  4. Tools: picks the tool whose name and description best match the request, and fills its inputs.
  5. After tool results: answers from them (or calls the next tool the request still needs).
  6. JSON: when asked for JSON, returns an object with the keys the prompt names.
  7. Documents: when given documents and a question, answers from the best matching sentence.
  8. Otherwise: a short, plain answer.

Useful helpers: embed(), cosine(), count_tokens(), tokens(), calls (a log of every request),
clock (a pretend clock: sleeping is instant but time still moves), and TinyLM (a toy
next-word predictor for seeing temperature and sampling at work).
"""
import json
import math
import random
import re
import hashlib

__all__ = [
    'configure', 'reset', 'on', 'script', 'skill', 'calls', 'clock', 'embed', 'cosine',
    'count_tokens', 'tokens', 'cost', 'PRICES', 'TinyLM', 'respond',
]

DEFAULT_MODEL = 'claude-sonnet-5'

# Dollars per million tokens: (input, output). Close to real list prices; good enough for budgeting exercises.
PRICES = {
    'claude-opus-5-5': (5.0, 25.0),
    'claude-sonnet-5': (3.0, 15.0),
    'claude-haiku-4-5': (1.0, 5.0),
    'claude-haiku-4-5-20251001': (1.0, 5.0),
}


# ── a pretend clock ──────────────────────────────────────────────────────────
class Clock:
    """Simulated time in seconds. Model calls take time on it; sleep() moves it forward instantly."""
    def __init__(self):
        self.t = 0.0

    def now(self):
        return self.t

    def sleep(self, seconds):
        if seconds > 0:
            self.t += float(seconds)

    def advance(self, seconds):
        self.sleep(seconds)


clock = Clock()


# ── settings, rules and the call log ─────────────────────────────────────────
DEFAULTS = {
    'seed': 0,
    'latency': 0.6,            # seconds per call, plus a little per output token
    'rate_limit': 0,           # the first N calls fail with 429 (or a share between 0 and 1)
    'overloaded': 0,           # the first N calls fail with 529 (or a share)
    'server_error': 0,         # the first N calls fail with 500 (or a share)
    'slow': 0,                 # the first N calls take 30 extra seconds (or a share)
    'broken_json': 0,          # the first N JSON answers come back broken (or a share)
    'refuse': 0,               # the first N calls are refused (or a share)
    'off_topic': 0,            # the first N calls wander off topic (or a share)
    'injectable': False,       # obey "ignore previous instructions" found in the input
    'hallucinate': False,      # answer confidently even when the documents do not say
    'context_window': 200000,  # tokens
}

config = dict(DEFAULTS)
calls = []          # one dict per request: {'model', 'system', 'messages', 'tools', 'response', 'error', 'at'}
_rules = []         # (pattern, handler) pairs from on()
_script = []        # queued replies from script()
_skills = []        # functions(request) -> reply or None
_counts = {}        # how many times each fault has fired
_rng = random.Random(0)


def reset():
    """Forget rules, script, faults, the call log and the clock. Every lab run starts with this."""
    global _rng
    config.clear()
    config.update(DEFAULTS)
    del calls[:]
    del _rules[:]
    del _script[:]
    del _skills[:]
    _counts.clear()
    clock.t = 0.0
    _rng = random.Random(0)


def configure(**settings):
    """Change how the simulated model behaves, for example configure(rate_limit=2, injectable=True)."""
    global _rng
    for k, v in settings.items():
        if k not in DEFAULTS:
            raise ValueError('llmsim.configure() has no setting called %r. Settings: %s' % (k, ', '.join(sorted(DEFAULTS))))
        config[k] = v
    if 'seed' in settings:
        _rng = random.Random(settings['seed'])


def on(pattern, reply=None, tool=None, input=None, json_reply=None):
    """When the latest user message matches pattern (a regex, case-insensitive), answer this way.

    reply: text, or a function(request) returning text.
    tool, input: call this tool with this input (input may be a function(request)).
    json_reply: an object to return as JSON text.
    """
    _rules.append((re.compile(pattern, re.I | re.S), dict(reply=reply, tool=tool, input=input, json_reply=json_reply)))


def script(*replies):
    """Queue exact replies for the next calls, in order. Each is text, or dict(tool=..., input=...),
    or dict(text=..., stop_reason=...)."""
    _script.extend(replies)


def skill(fn):
    """Register a function(request) -> reply-or-None that is tried before the built-in behaviour."""
    _skills.append(fn)
    return fn


# ── words, tokens and embeddings ─────────────────────────────────────────────
STOP = set('''a an the and or but if then so of to in on at by for with from as is are was were be been being am
do does did done have has had i me my we our you your he she it its they them their this that these those there here
what which who whom whose when where why how can could should would will shall may might must not no yes please
just also very really about into out up down over under again more most some any all each other than too only own same
s t don doesn didn won let lets get got tell give show find use using want need like hi hello hey thanks thank'''.split())

# Words that mean roughly the same thing share a "concept", so embed() puts them close together.
SYNONYMS = {}
for group in '''refund return reimburse reimbursement money_back chargeback
price cost fee charge charged billing bill invoice payment pay paid expensive cheap
cancel cancellation terminate unsubscribe stop quit
error bug crash crashes broken fail failure failing issue problem glitch fault exception technical tech
login log_in signin sign_in password credentials account username locked
ship shipping shipped delivery deliver delivered courier package parcel arrive arrival track tracking
car automobile vehicle auto
fast quick quickly speed rapid slow latency
happy glad pleased great love excellent good wonderful awesome
sad angry upset annoyed terrible awful bad hate disappointed frustrating frustrated
weather forecast temperature rain sunny snow
city town place location
buy purchase order ordered orders
help support assist assistance
doctor physician medical medicine clinic
big large huge
small little tiny
begin start starting
end finish finished
document doc file page article
search lookup look_up query
email mail e_mail message
phone call telephone
hours open opening schedule
duration long days day weeks week months month within period deadline
dog puppy canine
cat kitten feline'''.split('\n'):
    words = group.split()
    for w in words:
        SYNONYMS[w.replace('_', '')] = words[0]

_WORD = re.compile(r"[A-Za-z][A-Za-z']*|\d+(?:\.\d+)?")


def _stem(w):
    w = w.lower().replace("'", '')
    for suf in ('ingly', 'edly', 'ing', 'ies', 'ied', 'ed', 'es', 's', 'ly'):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            base = w[:-len(suf)]
            if suf in ('ies', 'ied'):
                base += 'y'
            return base
    return w


def words(text):
    """Lower-case words of a text, without the most common filler words."""
    return [w.lower() for w in _WORD.findall(text or '') if w.lower() not in STOP]


def concepts(text):
    """Words reduced to a shared concept: 'refunds', 'reimburse' and 'money back' all become 'refund'."""
    out = []
    ws = [w.lower().replace("'", '') for w in _WORD.findall(text or '')]
    for i, w in enumerate(ws):
        pair = w + (ws[i + 1] if i + 1 < len(ws) else '')
        if pair in SYNONYMS:
            out.append(SYNONYMS[pair])
            continue
        if w in STOP:
            continue
        c = SYNONYMS.get(w) or SYNONYMS.get(_stem(w)) or _stem(w)
        out.append(c)
    return out


def tokens(text):
    """Split text into tokens roughly the way a model's tokenizer does: common short words are
    one token, longer words are cut into pieces of up to four letters, and punctuation and
    spaces are tokens of their own."""
    out = []
    for m in re.finditer(r"\s+|[A-Za-z]+|\d|[^\sA-Za-z\d]", text or ''):
        piece = m.group(0)
        if piece.isalpha() and len(piece) > 6:
            out.extend(piece[i:i + 4] for i in range(0, len(piece), 4))
        elif piece.isspace():
            continue
        else:
            out.append(piece)
    return out


def count_tokens(value):
    """An estimate of how many tokens a text (or a list of messages, or any JSON value) uses."""
    if value is None:
        return 0
    if not isinstance(value, str):
        value = json.dumps(_plain(value), ensure_ascii=False)
    return len(tokens(value))


def cost(model, input_tokens, output_tokens):
    """Dollars for one call."""
    p_in, p_out = PRICES.get(model, PRICES[DEFAULT_MODEL])
    return (input_tokens * p_in + output_tokens * p_out) / 1e6


def _hash_vec(key, dim):
    h = hashlib.sha256(key.encode('utf8')).digest()
    v = []
    while len(v) < dim:
        for i in range(0, len(h), 2):
            v.append(((h[i] << 8 | h[i + 1]) / 65535.0) * 2 - 1)
        h = hashlib.sha256(h).digest()
    return v[:dim]


def embed(texts, dim=64):
    """Turn text into vectors whose directions carry meaning (roughly). Similar words share a
    concept, so 'refund policy' and 'money back rules' end up close. Accepts one string or a list;
    returns one vector or a list of vectors, each of length dim and length 1."""
    single = isinstance(texts, str)
    out = []
    for text in ([texts] if single else texts):
        acc = [0.0] * dim
        cs = concepts(text)
        for c in cs:
            for i, x in enumerate(_hash_vec(c, dim)):
                acc[i] += x
        for a, b in zip(cs, cs[1:]):          # a little word order
            for i, x in enumerate(_hash_vec(a + ' ' + b, dim)):
                acc[i] += 0.3 * x
        n = math.sqrt(sum(x * x for x in acc)) or 1.0
        out.append([x / n for x in acc])
    return out[0] if single else out


def cosine(a, b):
    """Cosine similarity of two vectors: 1 means the same direction, 0 means unrelated."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


# ── reading a request ────────────────────────────────────────────────────────
def _plain(x):
    """SDK objects (or anything with model_dump / to_dict) to plain dicts and lists."""
    if hasattr(x, 'model_dump'):
        return _plain(x.model_dump())
    if isinstance(x, dict):
        return {k: _plain(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_plain(v) for v in x]
    return x


def blocks(content):
    """A message's content as a list of block dicts."""
    content = _plain(content)
    if isinstance(content, str):
        return [{'type': 'text', 'text': content}]
    return list(content or [])


def text_of(content):
    """All the text in a message's content (tool results included)."""
    out = []
    for b in blocks(content):
        if b.get('type') == 'text':
            out.append(b.get('text', ''))
        elif b.get('type') == 'tool_result':
            out.append(text_of(b.get('content', '')))
        elif b.get('type') == 'document':
            src = b.get('source', {})
            out.append(src.get('data', '') if isinstance(src, dict) else '')
    return '\n'.join(o for o in out if o)


def system_text(system):
    if system is None:
        return ''
    if isinstance(system, str):
        return system
    return '\n'.join(b.get('text', '') for b in blocks(system))


class Request(object):
    """What the simulator sees: the model, system prompt, messages and tools of one call."""
    def __init__(self, kw):
        self.kw = kw
        self.model = kw.get('model') or DEFAULT_MODEL
        self.system = system_text(kw.get('system'))
        self.messages = [dict(role=m['role'], content=blocks(m['content'])) for m in _plain(kw.get('messages') or [])]
        self.tools = _plain(kw.get('tools') or [])
        self.tool_choice = _plain(kw.get('tool_choice') or {'type': 'auto'})
        self.max_tokens = kw.get('max_tokens') or 1024
        self.temperature = kw.get('temperature', 1.0)
        self.stop_sequences = kw.get('stop_sequences') or []
        self.n = len(calls)

    @property
    def last(self):
        return self.messages[-1] if self.messages else {'role': 'user', 'content': []}

    @property
    def user_text(self):
        """The latest plain text the user wrote (skipping tool results)."""
        for m in reversed(self.messages):
            if m['role'] == 'user':
                t = '\n'.join(b.get('text', '') for b in m['content'] if b.get('type') == 'text')
                if t.strip():
                    return t
        return ''

    @property
    def first_user_text(self):
        for m in self.messages:
            if m['role'] == 'user':
                t = '\n'.join(b.get('text', '') for b in m['content'] if b.get('type') == 'text')
                if t.strip():
                    return t
        return ''

    @property
    def all_text(self):
        return self.system + '\n' + '\n'.join(text_of(m['content']) for m in self.messages)

    def tool_results(self):
        """Tool results in the latest user message: list of (tool name, text, is_error)."""
        names = {}
        for m in self.messages:
            if m['role'] == 'assistant':
                for b in m['content']:
                    if b.get('type') == 'tool_use':
                        names[b['id']] = b['name']
        if self.last['role'] != 'user':
            return []
        return [(names.get(b.get('tool_use_id'), '?'), text_of(b.get('content', '')), bool(b.get('is_error')))
                for b in self.last['content'] if b.get('type') == 'tool_result']

    def tools_used(self):
        used = []
        for m in self.messages:
            if m['role'] == 'assistant':
                used += [(b['name'], json.dumps(b.get('input', {}), sort_keys=True)) for b in m['content'] if b.get('type') == 'tool_use']
        return used


# ── replies ──────────────────────────────────────────────────────────────────
class Reply(object):
    """What the model says: text and/or tool calls, and why it stopped."""
    def __init__(self, text='', tool_calls=None, stop_reason=None):
        self.text = text
        self.tool_calls = tool_calls or []      # [(name, input dict)]
        self.stop_reason = stop_reason or ('tool_use' if self.tool_calls else 'end_turn')


def _as_reply(r, req):
    if r is None:
        return None
    if isinstance(r, Reply):
        return r
    if isinstance(r, str):
        return Reply(r)
    if isinstance(r, dict):
        if r.get('tool'):
            inp = r.get('input') or {}
            return Reply(r.get('text', ''), [(r['tool'], inp(req) if callable(inp) else inp)])
        if r.get('json_reply') is not None:
            return Reply(json.dumps(r['json_reply']))
        rep = r.get('reply') if 'reply' in r else r.get('text', '')
        rep = rep(req) if callable(rep) else rep
        return Reply(rep or '', stop_reason=r.get('stop_reason'))
    raise TypeError('a reply must be text, a dict or a Reply, not %r' % type(r).__name__)


def _fires(name):
    """Should a fault fire on this call? An int N means the first N times; a float means that share."""
    v = config.get(name) or 0
    if not v:
        return False
    if isinstance(v, bool):
        return v
    if isinstance(v, float) and v < 1:
        return _rng.random() < v
    n = _counts.get(name, 0)
    if n < int(v):
        _counts[name] = n + 1
        return True
    return False


def _pick(options, req):
    """Deterministic choice at temperature 0; seeded variety above it."""
    if not req.temperature:
        return options[0]
    return options[_rng.randrange(len(options))]


# tools ──────────────────────────────────────────────────────────────────────
def _tool_score(tool, text):
    want = set(concepts(text))
    name = set(concepts(tool.get('name', '').replace('_', ' ')))
    desc = set(concepts(tool.get('description', '')))
    props = set()
    for p in (tool.get('input_schema') or {}).get('properties', {}):
        props |= set(concepts(p.replace('_', ' ')))
    return 3 * len(want & name) + len(want & desc) + 0.5 * len(want & props)


_CAPS = re.compile(r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)")


def _fill(tool, text):
    """Fill a tool's inputs from the request text, using the schema's names and types."""
    schema = tool.get('input_schema') or {}
    props = schema.get('properties', {})
    required = schema.get('required', list(props))
    numbers = re.findall(r'-?\d+(?:\.\d+)?', re.sub(r'\b[A-Z]{2,}-?\d+\b|#\d+|\d{4}-\d{2}-\d{2}', ' ', text))
    out = {}
    for name, spec in props.items():
        kind = spec.get('type', 'string')
        lname = name.lower()
        val = None
        if 'enum' in spec:
            low = text.lower()
            hits = [e for e in spec['enum'] if str(e).lower() in low]
            val = hits[0] if hits else (spec['enum'][0] if name in required else None)
        elif kind in ('number', 'integer'):
            if numbers:
                n = numbers.pop(0)
                val = int(float(n)) if kind == 'integer' else float(n)
        elif kind == 'boolean':
            val = bool(re.search(r'\b(yes|true|enable|on)\b', text, re.I))
        elif kind == 'array':
            items = re.findall(r'"([^"]+)"', text) or [w for w in re.split(r',\s*|\s+and\s+', _after_keywords(text)) if w]
            val = items
        else:
            m_q = re.search(r'"([^"]+)"|\'([^\']{2,})\'', text)
            if 'email' in lname:
                m = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
                val = m.group(0) if m else None
            elif lname in ('id', 'order_id', 'ticket_id', 'order', 'ticket', 'customer_id', 'user_id', 'invoice_id') or lname.endswith('_id'):
                m = re.search(r'\b[A-Z]{1,5}-?\d+\b|#\d+|\b\d{3,}\b', text)
                val = m.group(0).lstrip('#') if m else None
            elif 'date' in lname or 'day' in lname:
                m = re.search(r'\d{4}-\d{2}-\d{2}|today|tomorrow|yesterday', text, re.I)
                val = m.group(0) if m else None
            elif any(k in lname for k in ('city', 'location', 'place', 'country', 'destination', 'where')):
                m = re.search(r'\b(?:in|for|at|to|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', text)
                caps = [c for c in _CAPS.findall(text) if c.split()[0].lower() not in STOP]
                val = m.group(1) if m else (caps[0] if caps else None)
            elif any(k in lname for k in ('name', 'person', 'customer', 'author')):
                caps = [c for c in _CAPS.findall(text) if c.split()[0].lower() not in STOP]
                val = caps[0] if caps else None
            elif any(k in lname for k in ('expression', 'expr', 'formula', 'math')):
                m = re.search(r'[\d.\s()+\-*/^%]{3,}', text)
                val = m.group(0).strip().replace('^', '**') if m else None
            elif m_q:
                val = m_q.group(1) or m_q.group(2)
            else:
                val = _after_keywords(text)
        if val is not None and val != '':
            out[name] = val
        elif name in required:
            out[name] = '' if kind == 'string' else (0 if kind in ('number', 'integer') else None)
    return out


def _after_keywords(text):
    """The useful part of a request: drop polite openings like 'Can you please search for'."""
    t = text.strip().strip('?.! ')
    t = re.sub(r'^(?:(?:hi|hello|hey|please|could you|can you|would you|i want to|i need to|i would like to|help me)[\s,]+)+', '', t, flags=re.I)
    t = re.sub(r'^(?:search|look up|lookup|find|check|get|tell me|show me)\s+(?:for|about|on|the)?\s*', '', t, flags=re.I)
    return t.strip()


def _clauses(text):
    parts = re.split(r'\s*(?:;|\band then\b|\bthen\b|\band also\b|\balso\b|,?\s+and\s+(?=(?:what|how|who|when|where|is|are|can|check|find|get|look|search|tell|send|book|convert|calculate)\b))\s*', text, flags=re.I)
    return [p for p in parts if p and len(words(p)) > 0]


def _choose_tools(req, text, exclude=()):
    """Tool calls for a request: one per clause that clearly matches a different tool."""
    tools = req.tools
    choice = req.tool_choice or {}
    if not tools or choice.get('type') == 'none':
        return []
    if choice.get('type') == 'tool':
        t = next((t for t in tools if t['name'] == choice['name']), None)
        return [(t['name'], _fill(t, text))] if t else []
    picked = []
    for clause in _clauses(text) or [text]:
        scored = sorted(((_tool_score(t, clause), i, t) for i, t in enumerate(tools)), key=lambda x: (-x[0], x[1]))
        best = scored[0]
        if best[0] >= 2 or (choice.get('type') == 'any' and not picked):
            call = (best[2]['name'], _fill(best[2], clause))
            key = (call[0], json.dumps(call[1], sort_keys=True))
            if key not in exclude and call[0] not in [p[0] for p in picked]:
                picked.append(call)
    if not picked and choice.get('type') == 'any':
        t = tools[0]
        picked = [(t['name'], _fill(t, text))]
    return picked


# documents ──────────────────────────────────────────────────────────────────
def _documents(req):
    """(title, text) pairs found in the prompt: <document> tags, document blocks, or a Context: section."""
    docs = []
    whole = req.all_text
    for m in re.finditer(r'<(document|doc|source|context)([^>]*)>(.*?)</\1>', whole, re.S | re.I):
        attrs, body = m.group(2), m.group(3)
        t = re.search(r'(?:title|id|name|source)\s*=\s*["\']([^"\']+)', attrs)
        inner = re.search(r'<(?:title|source)>(.*?)</(?:title|source)>', body, re.S)
        content = re.search(r'<(?:content|document_content|text)>(.*?)</(?:content|document_content|text)>', body, re.S)
        title = t.group(1) if t else (inner.group(1).strip() if inner else 'document %d' % (len(docs) + 1))
        docs.append((title, (content.group(1) if content else re.sub(r'<[^>]+>', ' ', body)).strip()))
    if not docs:
        m = re.search(r'(?:^|\n)(?:context|documents?|sources?)\s*:\s*\n?(.*?)(?:\n\s*(?:question|q)\s*:|\Z)', whole, re.S | re.I)
        if m and len(m.group(1).strip()) > 40:
            docs.append(('context', m.group(1).strip()))
    for m in req.messages:
        for b in m['content']:
            if b.get('type') == 'document':
                src = b.get('source', {})
                docs.append((b.get('title') or 'document %d' % (len(docs) + 1), src.get('data', '') if isinstance(src, dict) else ''))
    return docs


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', text) if len(s.strip()) > 3]


def _question(req):
    q = req.user_text
    m = re.search(r'(?:question|q)\s*:\s*(.+)', q, re.I | re.S)
    if m:
        return m.group(1).strip()
    q = re.sub(r'<(document|doc|source|context)[^>]*>.*?</\1>', ' ', q, flags=re.S | re.I)
    lines = [l for l in q.strip().split('\n') if l.strip()]
    return lines[-1] if lines else q


def _answer_from_documents(req, docs):
    q = _question(req)
    qv = embed(q)
    qset = set(concepts(q))
    best = None
    for title, text in docs:
        for s in _sentences(text):
            overlap = len(qset & set(concepts(s)))
            score = cosine(qv, embed(s)) + 0.15 * overlap
            if overlap and (best is None or score > best[0]):
                best = (score, title, s)
    if best is None or best[0] < 0.45:
        if config['hallucinate']:
            return 'Yes. Based on the documents, this is fully covered and takes about 3 business days.'
        return "I don't know. The documents provided don't answer that."
    cite = re.search(r'cite|citation|source|\[\d', req.system + req.user_text, re.I)
    return best[2] + (' [%s]' % best[1] if cite else '')


# JSON ───────────────────────────────────────────────────────────────────────
POSITIVE = set('love great excellent good happy amazing wonderful fantastic awesome pleased glad perfect fast helpful best nice'.split())
NEGATIVE = set('hate terrible awful bad angry upset broken slow worst disappointed frustrating frustrated useless poor annoyed late never'.split())


def _sentiment(text):
    w = set(_stem(x) for x in words(text)) | set(words(text))
    p, n = len(w & POSITIVE), len(w & NEGATIVE)
    return 'positive' if p > n else 'negative' if n > p else 'neutral'


def _wants_json(req):
    return bool(re.search(r'\bjson\b', req.system + '\n' + req.user_text, re.I))


def _schema_keys(req):
    """Keys the prompt asks for: from an example object, a schema, or a 'keys: a, b, c' list."""
    text = req.system + '\n' + req.user_text
    for m in re.finditer(r'\{[^{}]*\}', text, re.S):
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and obj:
                if 'properties' in obj:
                    continue
                return list(obj.keys()), obj
        except ValueError:
            keys = re.findall(r'"(\w+)"\s*:', m.group(0))
            if keys:
                return keys, {}
    m = re.search(r'"properties"\s*:\s*\{(.*)', text, re.S)
    if m:
        keys = re.findall(r'"(\w+)"\s*:\s*\{', m.group(1))
        if keys:
            return keys, {}
    m = re.search(r'(?:keys|fields)\s*[:\-]?\s*([\w\s,`"\']+)', text, re.I)
    if m:
        keys = [k.strip(' `"\'') for k in re.split(r',|\band\b', m.group(1)) if k.strip(' `"\'')]
        keys = [k for k in keys if re.match(r'^\w+$', k)]
        if keys:
            return keys, {}
    return [], {}


def _options_for(key, req):
    """Allowed values for a key, if the prompt lists them: 'category: one of billing, bug, other'."""
    text = req.system + '\n' + req.user_text
    k = r'(?<![\w"\'])' + re.escape(key) + r'["\'`]?'
    m = (re.search(k + r'\s*\((?:one of|either)?:?\s*([\w\s,|"\'/-]+?)\)', text, re.I)
         or re.search(k + r'\s+(?:is|must be|should be|can be)?\s*(?:one of|either)\s*:?\s*\[?([\w\s,|"\'/-]+?)(?:\]|\.|\n|$)', text, re.I))
    if not m:
        return []
    opts = [o.strip(' "\'') for o in re.split(r',|\||/|\bor\b', m.group(1)) if o.strip(' "\'')]
    return [o for o in opts if len(o.split()) <= 3] if len(opts) >= 2 else []


def _source_text(req):
    """The text being described: quoted or tagged input if there is any, else the user message."""
    t = req.user_text
    m = re.search(r'<(email|text|review|ticket|message|input|document)>(.*?)</\1>', t, re.S | re.I)
    if m:
        return m.group(2)
    m = re.search(r'"""(.*?)"""|"([^"]{20,})"', t, re.S)
    if m:
        return m.group(1) or m.group(2)
    parts = t.split(':', 1)
    return parts[1] if len(parts) == 2 and len(parts[1]) > len(parts[0]) else t


def _value_for(key, example, req, src):
    k = key.lower()
    opts = _options_for(key, req)
    if opts:
        if 'sentiment' in k:
            s = _sentiment(src)
            return next((o for o in opts if o.lower() == s), opts[0])
        sv = embed(src)
        scores = [(cosine(sv, embed(o)) + 0.5 * len(set(concepts(o)) & set(concepts(src))), -i, o) for i, o in enumerate(opts)]
        return max(scores)[2]
    if 'sentiment' in k:
        return _sentiment(src)
    if 'email' in k:
        m = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', src)
        return m.group(0) if m else None
    if k in ('name', 'full_name', 'customer', 'customer_name', 'person', 'author'):
        m = re.search(r"(?:my name is|i am|i'm|this is|from|regards,?|thanks,?|cheers,?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", src)
        if m:
            return m.group(1)
        caps = [c for c in _CAPS.findall(src) if c.split()[0].lower() not in STOP]
        return caps[0] if caps else None
    if any(x in k for x in ('order', 'ticket', 'invoice')) or k.endswith('id'):
        m = re.search(r'\b[A-Z]{1,5}-?\d+\b|#\d+', src)
        return m.group(0).lstrip('#') if m else None
    if any(x in k for x in ('amount', 'price', 'total', 'count', 'quantity', 'age', 'number', 'score')):
        m = re.search(r'-?\d+(?:\.\d+)?', src)
        if m:
            v = float(m.group(0))
            return int(v) if v.is_integer() else v
        return None
    if 'date' in k:
        m = re.search(r'\d{4}-\d{2}-\d{2}', src)
        return m.group(0) if m else None
    if any(x in k for x in ('urgent', 'is_', 'has_', 'needs')) or isinstance(example.get(key), bool):
        return bool(re.search(r'urgent|asap|immediately|right now|emergency|critical', src, re.I))
    if any(x in k for x in ('summary', 'description', 'reason', 'title', 'topic', 'issue')):
        first = _sentences(src)
        return (first[0] if first else src.strip())[:120]
    if isinstance(example.get(key), list) or k.endswith('s') and k not in ('status', 'address'):
        return sorted(set(c for c in concepts(src) if len(c) > 3))[:3]
    return (src.strip().split('\n')[0])[:80]


def _json_reply(req):
    keys, example = _schema_keys(req)
    src = _source_text(req)
    if not keys:
        obj = {'answer': _plain_answer(req)}
    else:
        obj = {k: _value_for(k, example, req, src) for k in keys}
    text = json.dumps(obj, ensure_ascii=False)
    prefill = _prefill(req)
    if prefill and text.startswith(prefill):
        text = text[len(prefill):]
    return text


def _prefill(req):
    if req.last['role'] == 'assistant':
        return text_of(req.last['content'])
    return ''


def _break_json(text):
    """The ways real models get JSON wrong."""
    kind = _counts.get('broken_json', 1) % 3
    if kind == 1:
        return 'Sure! Here is the JSON you asked for:\n```json\n' + text + '\n```'
    if kind == 2:
        return text.rstrip('}') if text.endswith('}') else text[:-1]
    return text.replace('"', "'")


# plain answers ──────────────────────────────────────────────────────────────
FACTS = [
    (r'capital of france', 'The capital of France is Paris.'),
    (r'capital of japan', 'The capital of Japan is Tokyo.'),
    (r'capital of india', 'The capital of India is New Delhi.'),
    (r'largest planet', 'Jupiter is the largest planet in the solar system.'),
    (r'boiling point of water', 'Water boils at 100 °C at sea level.'),
    (r'who wrote hamlet', 'William Shakespeare wrote Hamlet.'),
    (r'speed of light', 'Light travels at about 299,792 km per second.'),
    (r'\b2\s*\+\s*2\b', '2 + 2 = 4.'),
]


def _plain_answer(req):
    text = req.user_text
    low = text.lower()
    for pat, ans in FACTS:
        if re.search(pat, low):
            return ans
    m = re.fullmatch(r'\s*(?:what is|calculate|compute)?\s*([\d.\s()+\-*/]+)\s*\??\s*', low)
    if m and re.search(r'\d\s*[+\-*/]\s*\d', m.group(1)):
        try:
            return '%s = %s' % (m.group(1).strip(), _num(eval(m.group(1), {'__builtins__': {}})))
        except Exception:
            pass
    if re.match(r'\s*(hi|hello|hey)\b', low):
        return _pick(['Hello! How can I help you today?', 'Hi there! What can I do for you?', 'Hello! What would you like to know?'], req)
    m = re.search(r'translate\s+["\']?(.+?)["\']?\s+(?:in)?to\s+(\w+)', text, re.I)
    if m:
        return '(%s) %s' % (m.group(2).capitalize(), m.group(1))
    m = re.search(r'summari[sz]e[^:]*:\s*(.+)', text, re.I | re.S)
    if m:
        first = _sentences(m.group(1))
        return 'In short: ' + (first[0] if first else m.group(1).strip()[:120])
    if re.search(r'\bmy name\b', low):
        for msg in req.messages:
            mm = re.search(r"my name is ([A-Z][a-z]+)", text_of(msg['content']))
            if mm and msg['role'] == 'user':
                return 'Your name is %s.' % mm.group(1)
        return "I don't know your name. You haven't told me yet."
    topic = ' '.join(words(text)[:6]) or 'that'
    return _pick([
        'Here is a short answer about %s. (This is the simulated model; a real model would give a fuller answer.)' % topic,
        'A brief reply on %s. (Simulated model: replies are short and predictable.)' % topic,
        'On %s: this is a placeholder answer from the simulated model.' % topic,
    ], req)


def _num(x):
    return int(x) if isinstance(x, float) and x.is_integer() else round(x, 6) if isinstance(x, float) else x


def _style(text, req):
    """A few system-prompt instructions the simulator follows."""
    s = req.system.lower()
    if re.search(r'one sentence|single sentence|be brief|concise|short answers?', s):
        first = _sentences(text)
        text = first[0] if first else text
    if re.search(r'pirate', s):
        text = 'Arr! ' + text
    if re.search(r'all caps|uppercase|upper case', s):
        text = text.upper()
    if re.search(r'in french', s):
        text = '(en français) ' + text
    return text


INJECTION = re.compile(r'ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+instructions?[\s,.:;-]*(.*)', re.I | re.S)


def _injection(req):
    """If the input contains an injected instruction, a vulnerable model follows it."""
    if not config['injectable']:
        return None
    defended = re.search(r'untrusted|treat .* as data|never follow instructions|do not follow instructions|ignore any instructions', req.system, re.I)
    for m in req.messages:
        for b in m['content']:
            raw = text_of([b])
            hit = INJECTION.search(raw)
            if not hit:
                continue
            fenced = re.search(r'<(untrusted|document|data|tool_output|email|webpage)[^>]*>.*ignore.*</\1>', raw, re.S | re.I)
            if defended and (fenced or b.get('type') == 'tool_result'):
                continue
            order = hit.group(1).strip().split('\n')[0].strip(' "\'')
            for t in req.tools:
                if t['name'] in order or t['name'].replace('_', ' ') in order.lower():
                    return Reply('', [(t['name'], _fill(t, order))])
            say = re.search(r'(?:say|reply|respond|answer|output|print)(?: with| only)?\s*:?\s*["\']?(.+?)["\']?\s*$', order, re.I)
            return Reply(say.group(1) if say else 'OK. ' + order)
    return None


def respond(req):
    """The simulator's decision for one request, as a Reply."""
    # 1. faults that change the answer
    if _fires('refuse'):
        return Reply("I'm sorry, but I can't help with that request.", stop_reason='refusal')
    if _fires('off_topic'):
        return Reply('Speaking of which, did you know octopuses have three hearts? It is one of my favourite facts.')
    # 2. scripted replies, rules and lab skills
    if _script:
        return _as_reply(_script.pop(0), req)
    for pat, rule in _rules:
        if pat.search(req.user_text or req.all_text):
            return _as_reply(rule, req)
    for fn in _skills:
        r = _as_reply(fn(req), req)
        if r is not None:
            return r
    # 3. prompt injection
    r = _injection(req)
    if r is not None:
        return r
    # 4 and 5. tools
    results = req.tool_results()
    if req.tools and not results:
        calls_ = _choose_tools(req, req.user_text)
        if calls_:
            lead = 'Let me look that up.' if len(calls_) == 1 else "I'll check those for you."
            return Reply(lead, calls_)
    if results:
        if all(err for _, _, err in results):
            name, text, _ = results[-1]
            used = req.tools_used()
            if sum(1 for n, _ in used if n == name) < 2:
                t = next((t for t in req.tools if t['name'] == name), None)
                if t:
                    retry = _fill(t, _after_keywords(req.first_user_text))
                    if json.dumps(retry, sort_keys=True) != used[-1][1]:
                        return Reply('That did not work; let me try again.', [(name, retry)])
            return Reply("I'm sorry, I couldn't complete that. The tool %s reported an error: %s" % (name, text.strip()[:200]))
        more = _choose_tools(req, req.first_user_text, exclude=set(req.tools_used()))
        more = [c for c in more if c[0] not in [n for n, _ in req.tools_used()]]
        if more:
            return Reply('', more)
        parts = [text.strip() for _, text, err in results if not err]
        if _wants_json(req):
            return Reply(_json_reply(req))
        return Reply(_style('Here is what I found: ' + ' '.join(parts), req))
    # 6. JSON
    if _wants_json(req):
        return Reply(_json_reply(req))
    # 7. documents
    docs = _documents(req)
    if docs:
        return Reply(_style(_answer_from_documents(req, docs), req))
    # 8. plain answer
    return Reply(_style(_plain_answer(req), req))


# ── a toy next-word model ────────────────────────────────────────────────────
class TinyLM(object):
    """A next-word predictor learned from a small text by counting which word follows which.
    Small enough to read, big enough to see temperature, top-k and top-p at work."""

    def __init__(self, corpus):
        self.counts = {}
        ws = re.findall(r"[a-z']+|[.!?]", corpus.lower())
        for a, b in zip(ws, ws[1:]):
            self.counts.setdefault(a, {}).setdefault(b, 0)
            self.counts[a][b] += 1
        self.vocab = sorted(set(ws))

    def next_word_probs(self, text):
        """{word: probability} for the word after the last word of text."""
        ws = re.findall(r"[a-z']+|[.!?]", text.lower())
        follow = self.counts.get(ws[-1] if ws else '.', {})
        if not follow:
            follow = {w: 1 for w in self.vocab}
        total = float(sum(follow.values()))
        return dict(sorted(((w, c / total) for w, c in follow.items()), key=lambda x: (-x[1], x[0])))

    def generate(self, prompt, n_words=8, temperature=1.0, top_k=None, top_p=None, seed=0):
        rng = random.Random(seed)
        out = prompt.strip()
        for _ in range(n_words):
            probs = self.next_word_probs(out)
            items = list(probs.items())
            if not temperature:
                w = items[0][0]
            else:
                logits = [math.log(p) / temperature for _, p in items]
                mx = max(logits)
                ps = [math.exp(l - mx) for l in logits]
                z = sum(ps)
                items = sorted(((w, p / z) for (w, _), p in zip(items, ps)), key=lambda x: -x[1])
                if top_k:
                    items = items[:top_k]
                if top_p:
                    keep, acc = [], 0.0
                    for w, p in items:
                        keep.append((w, p))
                        acc += p
                        if acc >= top_p:
                            break
                    items = keep
                z = sum(p for _, p in items)
                r, acc, w = rng.random() * z, 0.0, items[-1][0]
                for cand, p in items:
                    acc += p
                    if r <= acc:
                        w = cand
                        break
            out += w if w in '.!?' else ' ' + w
        return out
