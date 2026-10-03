"""A browser stand-in for the Anthropic Python SDK.

In the labs, `import anthropic` loads this module. It has the same shape as the real SDK
(client.messages.create, .stream, .count_tokens, the error classes, retries and timeouts),
but answers come from the simulated model in llmsim, so no API key or network is needed.
When you add your own API key in a lab's settings, steps marked "real Claude" send the same
request to the real API instead.

On your own computer, `pip install anthropic` gives you the real SDK, and the same code works.
"""
import json
import random
import re
import hashlib

import llmsim

__version__ = '0.0-sim'
SIMULATED = True

# Set by the lab when you choose to use your own key: {'key': 'sk-ant-...'}.
_REAL = None

DEFAULT_MAX_RETRIES = 2
DEFAULT_TIMEOUT = 600.0


# ── errors (same names and hierarchy as the real SDK) ───────────────────────
class AnthropicError(Exception):
    pass


class _Response(object):
    def __init__(self, status_code, headers=None):
        self.status_code = status_code
        self.headers = headers or {}


class APIError(AnthropicError):
    def __init__(self, message, body=None):
        super(APIError, self).__init__(message)
        self.message = message
        self.body = body


class APIStatusError(APIError):
    status_code = 0

    def __init__(self, message, status_code=None, body=None, headers=None):
        super(APIStatusError, self).__init__(message, body)
        if status_code is not None:
            self.status_code = status_code
        self.response = _Response(self.status_code, headers)
        self.request_id = 'req_sim_%06d' % len(llmsim.calls)


class BadRequestError(APIStatusError):
    status_code = 400


class AuthenticationError(APIStatusError):
    status_code = 401


class PermissionDeniedError(APIStatusError):
    status_code = 403


class NotFoundError(APIStatusError):
    status_code = 404


class RequestTooLargeError(APIStatusError):
    status_code = 413


class RateLimitError(APIStatusError):
    status_code = 429


class InternalServerError(APIStatusError):
    status_code = 500


class OverloadedError(APIStatusError):
    status_code = 529


class APIConnectionError(APIError):
    def __init__(self, message='Connection error.', body=None):
        super(APIConnectionError, self).__init__(message, body)


class APITimeoutError(APIConnectionError):
    def __init__(self, message='Request timed out.'):
        super(APITimeoutError, self).__init__(message)


_BY_STATUS = {400: BadRequestError, 401: AuthenticationError, 403: PermissionDeniedError, 404: NotFoundError,
              413: RequestTooLargeError, 429: RateLimitError, 529: OverloadedError}


def _error_for(status, message, body=None, headers=None):
    cls = _BY_STATUS.get(status) or (InternalServerError if status >= 500 else APIStatusError)
    return cls(message, status, body, headers)


# ── response objects ─────────────────────────────────────────────────────────
class _Obj(object):
    _fields = ()

    def __init__(self, **kw):
        for f in self._fields:
            setattr(self, f, kw.get(f))

    def model_dump(self, exclude_none=False):
        out = {}
        for f in self._fields:
            v = getattr(self, f)
            if isinstance(v, _Obj):
                v = v.model_dump(exclude_none)
            elif isinstance(v, list):
                v = [x.model_dump(exclude_none) if isinstance(x, _Obj) else x for x in v]
            if v is None and exclude_none:
                continue
            out[f] = v
        return out

    to_dict = model_dump

    def model_dump_json(self, indent=None):
        return json.dumps(self.model_dump(), indent=indent, ensure_ascii=False)

    to_json = model_dump_json

    def __getitem__(self, k):
        return getattr(self, k)

    def __eq__(self, other):
        return isinstance(other, _Obj) and self.model_dump() == other.model_dump()

    def __repr__(self):
        return '%s(%s)' % (type(self).__name__, ', '.join('%s=%r' % (f, getattr(self, f)) for f in self._fields))


class TextBlock(_Obj):
    _fields = ('type', 'text', 'citations')

    def model_dump(self, exclude_none=True):
        return _Obj.model_dump(self, True)


class ToolUseBlock(_Obj):
    _fields = ('type', 'id', 'name', 'input')


class Usage(_Obj):
    _fields = ('input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens')


class Message(_Obj):
    _fields = ('id', 'type', 'role', 'model', 'content', 'stop_reason', 'stop_sequence', 'usage')


class MessageTokensCount(_Obj):
    _fields = ('input_tokens',)


class types(object):
    """anthropic.types.Message and friends, for type hints and isinstance checks."""
    Message = Message
    TextBlock = TextBlock
    ToolUseBlock = ToolUseBlock
    Usage = Usage
    MessageTokensCount = MessageTokensCount


def _block(b):
    if b.get('type') == 'tool_use':
        return ToolUseBlock(type='tool_use', id=b['id'], name=b['name'], input=b.get('input', {}))
    if b.get('type') == 'text':
        return TextBlock(type='text', text=b.get('text', ''), citations=b.get('citations'))
    o = _Obj()
    o.__dict__.update(b)
    return o


def _message(d):
    u = d.get('usage') or {}
    return Message(
        id=d.get('id'), type='message', role='assistant', model=d.get('model'),
        content=[_block(b) for b in d.get('content', [])],
        stop_reason=d.get('stop_reason'), stop_sequence=d.get('stop_sequence'),
        usage=Usage(input_tokens=u.get('input_tokens', 0), output_tokens=u.get('output_tokens', 0),
                    cache_creation_input_tokens=u.get('cache_creation_input_tokens', 0),
                    cache_read_input_tokens=u.get('cache_read_input_tokens', 0)))


# ── checking a request the way the API does ──────────────────────────────────
_TOOL_NAME = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')


def _validate(kw):
    def bad(msg):
        raise BadRequestError('Error code: 400 - ' + msg, 400, {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': msg}})

    for k in ('model', 'max_tokens', 'messages'):
        if kw.get(k) is None:
            raise TypeError("Missing required argument: '%s'" % k)
    if not isinstance(kw['max_tokens'], int) or kw['max_tokens'] < 1:
        bad('max_tokens: must be a whole number of at least 1')
    t = kw.get('temperature')
    if t is not None and not (0 <= t <= 1):
        bad('temperature: must be between 0 and 1')
    msgs = llmsim._plain(kw['messages'])
    if not isinstance(msgs, list) or not msgs:
        bad('messages: at least one message is required')
    for i, m in enumerate(msgs):
        if not isinstance(m, dict) or m.get('role') not in ('user', 'assistant'):
            bad('messages.%d.role: must be "user" or "assistant" (the system prompt goes in the system parameter)' % i)
        if 'content' not in m:
            bad('messages.%d: missing content' % i)
        c = m['content']
        if isinstance(c, list):
            for j, b in enumerate(c):
                if not isinstance(b, dict) or 'type' not in b:
                    bad('messages.%d.content.%d: each block needs a "type"' % (i, j))
                if b['type'] == 'tool_result' and m['role'] != 'user':
                    bad('messages.%d: tool_result blocks belong in a user message' % i)
                if b['type'] == 'tool_use' and m['role'] != 'assistant':
                    bad('messages.%d: tool_use blocks belong in an assistant message' % i)
        elif not isinstance(c, str):
            bad('messages.%d.content: must be a string or a list of blocks' % i)
    if msgs[0]['role'] != 'user':
        bad('messages: the first message must use the "user" role')
    blocks = [llmsim.blocks(m['content']) for m in msgs]
    for i, m in enumerate(msgs):
        ids = [b['id'] for b in blocks[i] if b.get('type') == 'tool_use']
        if ids and m['role'] == 'assistant':
            nxt = blocks[i + 1] if i + 1 < len(msgs) else None
            if nxt is None:
                if i == len(msgs) - 1:
                    bad('messages.%d: the conversation ends with tool_use blocks. Add a user message with a tool_result for each one.' % i)
            else:
                got = [b.get('tool_use_id') for b in nxt if b.get('type') == 'tool_result']
                missing = [x for x in ids if x not in got]
                if missing:
                    bad('messages.%d: tool_use ids were found without tool_result blocks immediately after: %s. '
                        'Each tool_use block must have a matching tool_result block in the next message.' % (i, ', '.join(missing)))
        if m['role'] == 'user':
            res = [b.get('tool_use_id') for b in blocks[i] if b.get('type') == 'tool_result']
            prev = [b['id'] for b in blocks[i - 1] if b.get('type') == 'tool_use'] if i > 0 else []
            stray = [x for x in res if x not in prev]
            if stray:
                bad('messages.%d.content: unexpected tool_use_id found in tool_result blocks: %s. '
                    'Each tool_result block must have a matching tool_use block in the previous message.' % (i, ', '.join(map(str, stray))))
    for i, t in enumerate(llmsim._plain(kw.get('tools') or [])):
        if not isinstance(t, dict) or not _TOOL_NAME.match(str(t.get('name', ''))):
            bad('tools.%d.name: must be 1 to 64 letters, digits, _ or -' % i)
        schema = t.get('input_schema')
        if not isinstance(schema, dict) or schema.get('type') != 'object':
            bad('tools.%d.input_schema: must be a JSON schema with "type": "object"' % i)
    tc = llmsim._plain(kw.get('tool_choice'))
    if tc and tc.get('type') == 'tool' and tc.get('name') not in [t['name'] for t in llmsim._plain(kw.get('tools') or [])]:
        bad('tool_choice: there is no tool named %r' % tc.get('name'))


# ── the simulated call ───────────────────────────────────────────────────────
_cache = {}


def _cache_split(kw):
    """Prompt caching: tokens up to the last cache_control mark are written once, then read cheaply."""
    parts = []
    mark = -1
    for t in llmsim._plain(kw.get('tools') or []):
        parts.append(json.dumps(t, sort_keys=True))
        if t.get('cache_control'):
            mark = len(parts)
    sysv = kw.get('system')
    for b in (llmsim.blocks(sysv) if isinstance(sysv, list) else ([{'type': 'text', 'text': sysv}] if sysv else [])):
        parts.append(json.dumps(b.get('text', ''), sort_keys=True))
        if b.get('cache_control'):
            mark = len(parts)
    for m in llmsim._plain(kw['messages']):
        for b in llmsim.blocks(m['content']):
            parts.append(json.dumps({k: v for k, v in b.items() if k != 'cache_control'}, sort_keys=True))
            if b.get('cache_control'):
                mark = len(parts)
    total = sum(llmsim.count_tokens(p) for p in parts)
    if mark < 0:
        return total, 0, 0
    prefix = parts[:mark]
    n = sum(llmsim.count_tokens(p) for p in prefix)
    if n < 1024:                       # too short to cache, as with the real API
        return total, 0, 0
    key = hashlib.sha256((kw.get('model', '') + '\n'.join(prefix)).encode('utf8')).hexdigest()
    now = llmsim.clock.now()
    hit = key in _cache and now - _cache[key] < 300
    _cache[key] = now
    return total - n, (0 if hit else n), (n if hit else 0)


def _simulate(kw, timeout):
    req = llmsim.Request(kw)
    log = {'model': req.model, 'system': req.system, 'messages': req.messages, 'tools': req.tools,
           'response': None, 'error': None, 'at': llmsim.clock.now()}
    llmsim.calls.append(log)

    def fail(err):
        log['error'] = type(err).__name__
        raise err

    try:
        _validate(kw)
    except BadRequestError as e:
        fail(e)
    if llmsim._fires('rate_limit'):
        llmsim.clock.advance(0.05)
        fail(RateLimitError('Error code: 429 - rate_limit_error: Number of request tokens has exceeded your per-minute rate limit.',
                            429, {'type': 'error', 'error': {'type': 'rate_limit_error'}}, {'retry-after': '2'}))
    if llmsim._fires('overloaded'):
        llmsim.clock.advance(0.05)
        fail(OverloadedError('Error code: 529 - overloaded_error: Overloaded', 529, {'type': 'error', 'error': {'type': 'overloaded_error'}}))
    if llmsim._fires('server_error'):
        llmsim.clock.advance(0.05)
        fail(InternalServerError('Error code: 500 - api_error: Internal server error', 500, {'type': 'error', 'error': {'type': 'api_error'}}))

    in_tokens, cache_write, cache_read = _cache_split(kw)
    if in_tokens + cache_write + cache_read > llmsim.config['context_window']:
        fail(BadRequestError('Error code: 400 - prompt is too long: %d tokens > %d maximum'
                             % (in_tokens + cache_write + cache_read, llmsim.config['context_window']), 400))

    r = llmsim.respond(req)
    text = r.text or ''
    stop_reason, stop_seq = r.stop_reason, None
    if text and not r.tool_calls and llmsim._wants_json(req) and llmsim._fires('broken_json'):
        text = llmsim._break_json(text)
    for s in req.stop_sequences:
        if s and s in text:
            text, stop_reason, stop_seq = text[:text.index(s)], 'stop_sequence', s
            break
    content = []
    if text:
        content.append({'type': 'text', 'text': text})
    for name, inp in r.tool_calls:
        content.append({'type': 'tool_use', 'id': 'toolu_sim_%02d_%d' % (len(llmsim.calls), len(content)), 'name': name, 'input': inp})
    out_tokens = sum(llmsim.count_tokens(b.get('text') or b.get('input')) + (8 if b['type'] == 'tool_use' else 0) for b in content)
    if out_tokens > req.max_tokens:
        toks = llmsim.tokens(text)[:req.max_tokens]
        cut = text
        if toks:
            last = toks[-1]
            pos, i = 0, 0
            for tk in toks:
                pos = text.find(tk, pos) + len(tk)
            cut = text[:pos]
        content = [{'type': 'text', 'text': cut}] if cut else []
        out_tokens, stop_reason = req.max_tokens, 'max_tokens'

    latency = llmsim.config['latency'] + 0.012 * out_tokens + (30.0 if llmsim._fires('slow') else 0.0)
    if latency > timeout:
        llmsim.clock.advance(timeout)
        fail(APITimeoutError())
    llmsim.clock.advance(latency)

    msg = {'id': 'msg_sim_%04d' % len(llmsim.calls), 'model': req.model, 'content': content,
           'stop_reason': stop_reason, 'stop_sequence': stop_seq,
           'usage': {'input_tokens': in_tokens, 'output_tokens': out_tokens,
                     'cache_creation_input_tokens': cache_write, 'cache_read_input_tokens': cache_read}}
    log['response'] = msg
    log['latency'] = latency
    return _message(msg)


# ── a real call, from the browser, with your own key ─────────────────────────
def _real_call(kw, path='/v1/messages'):
    from js import XMLHttpRequest   # only available in the browser
    body = {k: llmsim._plain(v) for k, v in kw.items() if v is not None and k not in ('stream', 'timeout', 'extra_headers')}
    llmsim.calls.append({'model': body.get('model'), 'system': llmsim.system_text(body.get('system')),
                         'messages': body.get('messages'), 'tools': body.get('tools') or [], 'response': None,
                         'error': None, 'at': llmsim.clock.now(), 'real': True})
    xhr = XMLHttpRequest.new()
    xhr.open('POST', 'https://api.anthropic.com' + path, False)
    xhr.setRequestHeader('content-type', 'application/json')
    xhr.setRequestHeader('anthropic-version', '2023-06-01')
    xhr.setRequestHeader('x-api-key', _REAL['key'])
    xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true')
    try:
        xhr.send(json.dumps(body))
    except Exception:
        llmsim.calls[-1]['error'] = 'APIConnectionError'
        raise APIConnectionError('Could not reach api.anthropic.com. Check your connection.')
    status = int(xhr.status)
    try:
        data = json.loads(xhr.responseText)
    except ValueError:
        data = {}
    if status == 0:
        llmsim.calls[-1]['error'] = 'APIConnectionError'
        raise APIConnectionError('Could not reach api.anthropic.com. Check your connection.')
    if status >= 400:
        err = (data.get('error') or {})
        llmsim.calls[-1]['error'] = _error_for(status, '').__class__.__name__
        raise _error_for(status, 'Error code: %d - %s: %s' % (status, err.get('type', 'error'), err.get('message', '')), data,
                         {'retry-after': xhr.getResponseHeader('retry-after')})
    llmsim.calls[-1]['response'] = data
    return data


# ── the client ───────────────────────────────────────────────────────────────
class _Event(_Obj):
    _fields = ('type', 'index', 'delta', 'message', 'content_block', 'usage')


class _Delta(_Obj):
    _fields = ('type', 'text', 'partial_json', 'stop_reason', 'stop_sequence')


def _events(msg):
    yield _Event(type='message_start', message=Message(id=msg.id, type='message', role='assistant', model=msg.model,
                                                       content=[], stop_reason=None, stop_sequence=None,
                                                       usage=Usage(input_tokens=msg.usage.input_tokens, output_tokens=1)))
    for i, b in enumerate(msg.content):
        if b.type == 'text':
            yield _Event(type='content_block_start', index=i, content_block=TextBlock(type='text', text=''))
            for piece in re.findall(r'\S+\s*|\s+', b.text):
                yield _Event(type='content_block_delta', index=i, delta=_Delta(type='text_delta', text=piece))
        else:
            yield _Event(type='content_block_start', index=i, content_block=ToolUseBlock(type='tool_use', id=b.id, name=b.name, input={}))
            yield _Event(type='content_block_delta', index=i, delta=_Delta(type='input_json_delta', partial_json=json.dumps(b.input)))
        yield _Event(type='content_block_stop', index=i)
    yield _Event(type='message_delta', delta=_Delta(type='message_delta', stop_reason=msg.stop_reason, stop_sequence=msg.stop_sequence),
                 usage=Usage(output_tokens=msg.usage.output_tokens))
    yield _Event(type='message_stop')


class MessageStream(object):
    """What client.messages.stream(...) returns. Use it in a with-block."""
    def __init__(self, make):
        self._make = make
        self._msg = None

    def __enter__(self):
        self._msg = self._make()
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        return _events(self._msg)

    @property
    def text_stream(self):
        for e in _events(self._msg):
            if e.type == 'content_block_delta' and e.delta.type == 'text_delta':
                yield e.delta.text

    def until_done(self):
        for _ in self:
            pass

    def get_final_message(self):
        return self._msg

    def get_final_text(self):
        return ''.join(b.text for b in self._msg.content if b.type == 'text')


class Messages(object):
    def __init__(self, client):
        self._client = client

    def create(self, **kw):
        stream = kw.pop('stream', False)
        msg = self._client._send(kw)
        return _events(msg) if stream else msg

    def stream(self, **kw):
        return MessageStream(lambda: self._client._send(kw))

    def count_tokens(self, **kw):
        kw.setdefault('max_tokens', 1)
        if _REAL and self._client._real:
            data = _real_call({k: v for k, v in kw.items() if k != 'max_tokens'}, '/v1/messages/count_tokens')
            return MessageTokensCount(input_tokens=data.get('input_tokens', 0))
        _validate(kw)
        n = llmsim.count_tokens(kw.get('system')) + llmsim.count_tokens(kw['messages']) + llmsim.count_tokens(kw.get('tools'))
        return MessageTokensCount(input_tokens=n)


class Anthropic(object):
    """client = anthropic.Anthropic(); client.messages.create(model=..., max_tokens=..., messages=[...])"""

    def __init__(self, api_key=None, max_retries=DEFAULT_MAX_RETRIES, timeout=DEFAULT_TIMEOUT, base_url=None, **_):
        self.api_key = api_key
        self.max_retries = max_retries
        self.timeout = float(timeout) if timeout is not None else DEFAULT_TIMEOUT
        self.messages = Messages(self)
        self._real = _REAL is not None

    def with_options(self, max_retries=None, timeout=None, **_):
        c = Anthropic(self.api_key, self.max_retries if max_retries is None else max_retries,
                      self.timeout if timeout is None else timeout)
        c._real = self._real
        return c

    def _send(self, kw):
        timeout = float(kw.pop('timeout', None) or self.timeout)
        attempt = 0
        while True:
            try:
                if _REAL is not None and self._real:
                    return _message(_real_call(kw))
                return _simulate(kw, timeout)
            except (RateLimitError, InternalServerError, OverloadedError, APIConnectionError) as e:
                if attempt >= self.max_retries:
                    raise
                after = None
                resp = getattr(e, 'response', None)
                if resp is not None and resp.headers.get('retry-after'):
                    try:
                        after = float(resp.headers['retry-after'])
                    except (TypeError, ValueError):
                        after = None
                wait = after if after is not None else min(0.5 * 2 ** attempt, 8.0) * (1 - 0.25 * random.Random(attempt).random())
                llmsim.clock.sleep(wait)
                attempt += 1


Client = Anthropic
