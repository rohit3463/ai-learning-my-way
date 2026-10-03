// A small multi-file project, used to test the lab platform (project mode, the simulated model,
// exercises and the optional real-Claude step). Open tools/fixtures/lab.html?lab=demo-agent.
// It doubles as a template for writing project labs.
(() => {
  const R = String.raw;
  window.LABS = window.LABS || {};
  window.LABS['demo-agent'] = {
    mode: 'project',
    llm: true,
    folder: 'order-agent',
    title: 'A tiny order-status agent',
    intro: R`Three files, three milestones: a tool, the agent loop that uses it, and an evaluation that scores the agent.`,
    doneTitle: 'Your agent works.',
    doneText: 'Download the folder, set ANTHROPIC_API_KEY, and run python evals.py.',
    requirements: 'anthropic>=0.40\n',
    readme: '# Order agent\n\n```\npip install -r requirements.txt\nexport ANTHROPIC_API_KEY=sk-ant-...\npython evals.py\n```\n',
    run: 'pip install -r requirements.txt\nexport ANTHROPIC_API_KEY=sk-ant-...\npython evals.py',
    files: {
      'tools.py': R`ORDERS = {"A-1042": "shipped", "B-77": "processing"}


def lookup_order(order_id):
    """Return a sentence about the order's status."""
    return ""


TOOLS = [{
    "name": "lookup_order",
    "description": "Look up the status of a customer order by its order id.",
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "An order id such as A-1042"}},
        "required": ["order_id"],
    },
}]
`,
      'agent.py': R`import anthropic
from tools import TOOLS, lookup_order

MODEL = "claude-sonnet-5"
client = anthropic.Anthropic()


def run(question):
    """Answer a question, calling tools as needed. Return the final text."""
    return ""
`,
      'evals.py': R`from agent import run

CASES = [
    ("Where is my order A-1042?", "shipped"),
    ("What's the status of order B-77?", "processing"),
    ("Where is order Z-9?", "no order"),
]


def score(cases):
    """The share of cases whose answer contains the expected words (ignoring case)."""
    return 0.0


if __name__ == "__main__":
    print(f"score: {score(CASES):.0%}")
`,
    },
    steps: [
      {
        id: 'tool',
        title: 'Write the tool',
        file: 'tools.py',
        brief: R`<p>In <code>tools.py</code>, make <code>lookup_order(order_id)</code> return <code>"Order A-1042: shipped"</code> for a known order, and <code>"No order called Z-9"</code> for an unknown one.</p>`,
        hint: R`Use <code>ORDERS.get(order_id)</code> and an f-string.`,
        solution: {
          'tools.py': R`ORDERS = {"A-1042": "shipped", "B-77": "processing"}


def lookup_order(order_id):
    """Return a sentence about the order's status."""
    status = ORDERS.get(order_id)
    if status is None:
        return f"No order called {order_id}"
    return f"Order {order_id}: {status}"


TOOLS = [{
    "name": "lookup_order",
    "description": "Look up the status of a customer order by its order id.",
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "An order id such as A-1042"}},
        "required": ["order_id"],
    },
}]
`,
        },
        tests: [
          { name: 'known order', check: R`from tools import lookup_order; r = lookup_order("A-1042"); assert r == "Order A-1042: shipped", repr(r)` },
          { name: 'unknown order', check: R`from tools import lookup_order; r = lookup_order("Z-9"); assert r == "No order called Z-9", repr(r)` },
        ],
      },
      {
        id: 'loop',
        title: 'The agent loop',
        file: 'agent.py',
        brief: R`<p>In <code>agent.py</code>, write <code>run(question)</code>: send the question with <code>tools=TOOLS</code>; while the model asks for a tool (<code>stop_reason == "tool_use"</code>), run it and send back a <code>tool_result</code>; return the final text.</p>`,
        hint: R`Append <code>{"role": "assistant", "content": response.content}</code>, then a user message holding one <code>tool_result</code> per <code>tool_use</code> block.`,
        solution: {
          'agent.py': R`import anthropic
from tools import TOOLS, lookup_order

MODEL = "claude-sonnet-5"
client = anthropic.Anthropic()


def run(question):
    """Answer a question, calling tools as needed. Return the final text."""
    messages = [{"role": "user", "content": question}]
    for _ in range(10):
        response = client.messages.create(model=MODEL, max_tokens=1024, tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason != "tool_use":
            return "".join(b.text for b in response.content if b.type == "text")
        results = []
        for block in response.content:
            if block.type == "tool_use":
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": lookup_order(**block.input)})
        messages.append({"role": "user", "content": results})
    return "Stopped: too many steps."
`,
        },
        tests: [
          { name: 'answers from the tool', check: R`from agent import run; a = run("Where is my order A-1042?"); assert "shipped" in a, repr(a)` },
          { name: 'two model calls: ask, then answer', check: R`import llmsim; from agent import run; llmsim.reset(); run("Where is my order B-77?"); assert len(llmsim.calls) == 2, f"{len(llmsim.calls)} calls"` },
          { name: 'the tool result goes back to the model', check: R`import llmsim; from agent import run; llmsim.reset(); run("Where is my order B-77?"); last = llmsim.calls[-1]["messages"][-1]; assert any(b.get("type") == "tool_result" for b in last["content"]), last` },
        ],
      },
      {
        id: 'evals',
        title: 'Score the agent',
        file: 'evals.py',
        brief: R`<p>In <code>evals.py</code>, write <code>score(cases)</code>: run each question and return the share of answers that contain the expected words, ignoring case.</p>`,
        hint: R`<code>sum(expected in run(q).lower() for q, expected in cases) / len(cases)</code>`,
        solution: {
          'evals.py': R`from agent import run

CASES = [
    ("Where is my order A-1042?", "shipped"),
    ("What's the status of order B-77?", "processing"),
    ("Where is order Z-9?", "no order"),
]


def score(cases):
    """The share of cases whose answer contains the expected words (ignoring case)."""
    return sum(expected in run(q).lower() for q, expected in cases) / len(cases)


if __name__ == "__main__":
    print(f"score: {score(CASES):.0%}")
`,
        },
        tests: [
          { name: 'all three cases pass', check: R`from evals import score, CASES; s = score(CASES); assert s == 1.0, f"score {s}"` },
          { name: 'a wrong expectation scores 0', check: R`from evals import score; s = score([("Where is my order A-1042?", "cancelled")]); assert s == 0.0, f"score {s}"` },
        ],
      },
      {
        id: 'real',
        title: 'Try it on real Claude',
        optional: true,
        real: true,
        file: 'agent.py',
        brief: R`<p>Nothing to write: run the tests. With your API key added, your agent talks to real Claude; without one, to the simulated model.</p>`,
        hint: R`Just press Run.`,
        solution: {},
        tests: [
          { name: 'a real answer mentions the status', check: R`from agent import run; a = run("Where is my order A-1042?"); assert "shipped" in a.lower(), repr(a)` },
        ],
      },
    ],
    exercises: [
      {
        id: 'limit',
        type: 'extend',
        title: 'Cap the steps',
        file: 'agent.py',
        add: { 'agent.py': R`def run_capped(question, max_steps):
    """Like run(), but stop after max_steps model calls and return "Stopped"."""
    return ""
` },
        brief: R`<p>Write <code>run_capped(question, max_steps)</code> in <code>agent.py</code>: the same loop, but after <code>max_steps</code> model calls without a final answer, return <code>"Stopped"</code>.</p>`,
        hints: ['Copy the loop from run() and use range(max_steps).', 'Return "Stopped" after the loop ends.'],
        solution: {
          'agent.py': R`import anthropic
from tools import TOOLS, lookup_order

MODEL = "claude-sonnet-5"
client = anthropic.Anthropic()


def run(question):
    """Answer a question, calling tools as needed. Return the final text."""
    return run_capped(question, 10)


def run_capped(question, max_steps):
    """Like run(), but stop after max_steps model calls and return "Stopped"."""
    messages = [{"role": "user", "content": question}]
    for _ in range(max_steps):
        response = client.messages.create(model=MODEL, max_tokens=1024, tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason != "tool_use":
            return "".join(b.text for b in response.content if b.type == "text")
        results = [{"type": "tool_result", "tool_use_id": b.id, "content": lookup_order(**b.input)}
                   for b in response.content if b.type == "tool_use"]
        messages.append({"role": "user", "content": results})
    return "Stopped"
`,
        },
        tests: [
          { name: 'one call is not enough', check: R`from agent import run_capped; r = run_capped("Where is my order A-1042?", 1); assert r == "Stopped", repr(r)` },
          { name: 'two calls are enough', check: R`from agent import run_capped; r = run_capped("Where is my order A-1042?", 2); assert "shipped" in r, repr(r)` },
        ],
      },
    ],
  };
})();
