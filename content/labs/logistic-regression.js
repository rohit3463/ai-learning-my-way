// Coding lab for the Logistic Regression lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter code, hint, solution,
// and tests. A test is { name, check } where check is Python that raises AssertionError on failure.
// Tests run after all earlier steps' code, so every function written so far is available.
// close(a, b, tol=0.01) is provided for comparing decimals.
(() => {
  const R = String.raw;
  window.LABS = window.LABS || {};
  window.LABS['logistic-regression'] = {
    file: 'logistic_regression.py',
    title: 'Write logistic regression from scratch',
    intro: R`Twelve small steps again, reusing the ideas from Lesson 1. You will build the squash, the log loss and the pulls, then train a model that predicts whether a student passes an exam. Plain Python, with only the built-in <code>math</code> module.`,
    doneTitle: 'You wrote logistic regression from scratch.',
    doneText: 'Every line below is yours: scores, the sigmoid, the log loss, the pulls, the gradients and the training loop. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your logistic regression works.',
    steps: [
      {
        id: 'data',
        title: 'Store the points',
        brief: R`<p>Start with the two points from the worked example:</p>
          <ul><li>Point A: \(x = 1\), answer yes (\(y = 1\))</li><li>Point B: \(x = -1\), answer no (\(y = 0\))</li></ul>
          <p>Store the inputs in <code>xs</code> and the answers in <code>ys</code>, in that order (A first).</p>`,
        starter: R`# The two points from the worked example
xs = []
ys = []`,
        hint: R`<code>xs = [1, -1]</code> and <code>ys = [1, 0]</code>.`,
        solution: R`# The two points from the worked example
xs = [1, -1]
ys = [1, 0]`,
        tests: [
          { name: 'xs holds 1, −1', check: R`assert list(xs) == [1, -1], f"xs is {xs!r}, expected [1, -1]"` },
          { name: 'ys holds 1, 0', check: R`assert list(ys) == [1, 0], f"ys is {ys!r}, expected [1, 0]. Yes is 1, no is 0"` },
        ],
      },
      {
        id: 'score',
        title: 'The score',
        brief: R`<p>Logistic regression starts with the same straight line as before. Its output is called the score:</p>
          \[ z = w \times x + b \]
          <p>Write <code>score(w, b, x)</code>.</p>`,
        starter: R`def score(w, b, x):
    # The straight-line score:  z = w * x + b
    return 0`,
        hint: R`<code>return w * x + b</code>, the same as <code>predict</code> in Lesson 1.`,
        solution: R`def score(w, b, x):
    # The straight-line score:  z = w * x + b
    return w * x + b`,
        tests: [
          { name: 'score(2, 1, 3) is 7', check: R`r = score(2, 1, 3); assert r == 7, f"got {r}, expected 2 × 3 + 1 = 7"` },
          { name: 'score(0.5, 0, -1) is −0.5', check: R`r = score(0.5, 0, -1); assert close(r, -0.5), f"got {r}, expected −0.5"` },
        ],
      },
      {
        id: 'sigmoid',
        title: 'The squash',
        brief: R`<p>The sigmoid squashes any score into a probability between 0 and 1:</p>
          \[ p = \frac{1}{1 + e^{-z}} \]
          <p>Write <code>sigmoid(z)</code>. Python's <code>math.exp(v)</code> computes \(e^{v}\). The import is already there.</p>`,
        starter: R`import math

def sigmoid(z):
    # p = 1 / (1 + e^(-z))
    return 0`,
        hint: R`<code>return 1 / (1 + math.exp(-z))</code>. Mind the minus sign in front of <code>z</code>.`,
        solution: R`import math

def sigmoid(z):
    # p = 1 / (1 + e^(-z))
    return 1 / (1 + math.exp(-z))`,
        tests: [
          { name: 'a score of 0 is a coin toss', check: R`r = sigmoid(0); assert close(r, 0.5, 1e-9), f"got {r}, expected 0.5"` },
          { name: 'a score of 4 is almost certainly yes', check: R`r = sigmoid(4); assert close(r, 0.982, 0.001), f"got {r}, expected 0.982"` },
          { name: 'a score of −1 is leaning no', check: R`r = sigmoid(-1); assert close(r, 0.269, 0.001), f"got {r}, expected 0.269. Check the sign of z"` },
          { name: 'always between 0 and 1', check: R`assert all(0 < sigmoid(z) < 1 for z in [-20, -3, 0, 3, 20]), "some output was outside 0 to 1"` },
        ],
      },
      {
        id: 'probs',
        title: 'Probability for every point',
        brief: R`<p>Combine the two: score each \(x\), then squash it.</p>
          <p>Write <code>predict_proba(w, b, xs)</code> that returns a list with the probability of yes for every point.</p>`,
        starter: R`def predict_proba(w, b, xs):
    # One probability of "yes" per x: sigmoid(score(...))
    return []`,
        hint: R`<code>return [sigmoid(score(w, b, x)) for x in xs]</code>`,
        solution: R`def predict_proba(w, b, xs):
    # One probability of "yes" per x: sigmoid(score(...))
    return [sigmoid(score(w, b, x)) for x in xs]`,
        tests: [
          { name: 'no opinion yet: w = 0, b = 0 gives 0.5 each', check: R`r = predict_proba(0, 0, xs); assert len(r) == 2 and all(close(p, 0.5, 1e-9) for p in r), f"got {r}, expected [0.5, 0.5]"` },
          { name: 'round 2 probabilities match the table', check: R`r = predict_proba(0.5, 0, xs); assert close(r[0], 0.622, 0.001) and close(r[1], 0.378, 0.001), f"got {r}, expected [0.622, 0.378]"` },
        ],
      },
      {
        id: 'cost',
        title: 'The cost of one answer',
        brief: R`<p>The cost is minus the log of the chance the model gave to the right answer:</p>
          <ul><li>yes point (\(y = 1\)): \(\text{cost} = -\log(p)\)</li><li>no point (\(y = 0\)): \(\text{cost} = -\log(1 - p)\)</li></ul>
          <p>Write <code>cost(p, y)</code>. Python's <code>math.log</code> is the natural log.</p>`,
        starter: R`def cost(p, y):
    # -log(chance given to the right answer)
    return 0`,
        hint: R`Use an <code>if</code>: when <code>y == 1</code> return <code>-math.log(p)</code>, otherwise return <code>-math.log(1 - p)</code>.`,
        solution: R`def cost(p, y):
    # -log(chance given to the right answer)
    if y == 1:
        return -math.log(p)
    return -math.log(1 - p)`,
        tests: [
          { name: 'a coin toss costs 0.69', check: R`r = cost(0.5, 1); assert close(r, 0.693, 0.001), f"got {r}, expected 0.693"` },
          { name: 'sure and right is cheap', check: R`r = cost(0.9, 1); assert close(r, 0.105, 0.001), f"got {r}, expected 0.105"` },
          { name: 'sure and wrong is expensive', check: R`r = cost(0.9, 0); assert close(r, 2.303, 0.001), f"got {r}, expected 2.303. For a no point, the right answer's chance is 1 − p"` },
          { name: 'the cost is never negative', check: R`assert all(cost(p, y) >= 0 for p in [0.1, 0.5, 0.9] for y in [0, 1]), "a cost came out negative. Did you keep the minus sign?"` },
        ],
      },
      {
        id: 'log_loss',
        title: 'Score the whole model',
        brief: R`<p>The loss is the average cost over all the points:</p>
          \[ L = \frac{\text{cost}_1 + \text{cost}_2 + \dots + \text{cost}_n}{n} \]
          <p>Write <code>log_loss(w, b, xs, ys)</code>. Use <code>predict_proba</code> and <code>cost</code>.</p>`,
        starter: R`def log_loss(w, b, xs, ys):
    # Average cost over all points
    return 0`,
        hint: R`<code>probs = predict_proba(w, b, xs)</code>, then <code>return sum(cost(p, y) for p, y in zip(probs, ys)) / len(ys)</code>.`,
        solution: R`def log_loss(w, b, xs, ys):
    # Average cost over all points
    probs = predict_proba(w, b, xs)
    return sum(cost(p, y) for p, y in zip(probs, ys)) / len(ys)`,
        tests: [
          { name: 'no opinion costs 0.693', check: R`r = log_loss(0, 0, xs, ys); assert close(r, 0.693, 0.001), f"got {r}, expected 0.693"` },
          { name: 'after one step (w = 0.5) the loss is 0.474', check: R`r = log_loss(0.5, 0, xs, ys); assert close(r, 0.474, 0.001), f"got {r}, expected 0.474"` },
          { name: 'believing the opposite costs more', check: R`assert log_loss(-2, 0, xs, ys) > 0.693, "a model that points the wrong way should cost more than a coin toss"` },
        ],
      },
      {
        id: 'pulls',
        title: 'Each point’s pull',
        brief: R`<p>Every point pulls on the curve by the gap between what the model said and the truth:</p>
          \[ \text{pull} = p - y \]
          <p>Write <code>pulls(probs, ys)</code> that returns one pull per point.</p>`,
        starter: R`def pulls(probs, ys):
    # One pull per point:  p - y
    return []`,
        hint: R`<code>return [p - y for p, y in zip(probs, ys)]</code>. Note the order: \(p\) first.`,
        solution: R`def pulls(probs, ys):
    # One pull per point:  p - y
    return [p - y for p, y in zip(probs, ys)]`,
        tests: [
          { name: 'round 1 pulls are [−0.5, 0.5]', check: R`r = pulls([0.5, 0.5], [1, 0]); assert all(close(a, b, 1e-9) for a, b in zip(r, [-0.5, 0.5])), f"got {r}, expected [-0.5, 0.5]"` },
          { name: 'p minus y, not the other way', check: R`r = pulls([0.2], [1]); assert close(r[0], -0.8, 1e-9), f"got {r}. A yes point at p = 0.2 should pull −0.8"` },
        ],
      },
      {
        id: 'gradient_w',
        title: 'The slope for w',
        brief: R`<p>Multiply each pull by its \(x\) and average:</p>
          \[ \frac{dL}{dw} = \frac{(p_1 - y_1) \times x_1 + \dots + (p_n - y_n) \times x_n}{n} \]
          <p>Write <code>gradient_w(xs, pls)</code>, where <code>pls</code> is the list of pulls.</p>`,
        starter: R`def gradient_w(xs, pls):
    # average of pull * x
    return 0`,
        hint: R`<code>return sum(p * x for p, x in zip(pls, xs)) / len(xs)</code>`,
        solution: R`def gradient_w(xs, pls):
    # average of pull * x
    return sum(p * x for p, x in zip(pls, xs)) / len(xs)`,
        tests: [
          { name: 'round 1 slope is −0.5', check: R`r = gradient_w([1, -1], [-0.5, 0.5]); assert close(r, -0.5, 1e-9), f"got {r}, expected (−0.5 × 1 + 0.5 × −1) / 2 = −0.5"` },
          { name: 'no pulls, flat slope', check: R`r = gradient_w([1, 2], [0, 0]); assert r == 0, f"got {r}, expected 0"` },
        ],
      },
      {
        id: 'gradient_b',
        title: 'The slope for b',
        brief: R`<p>The slope for \(b\) is simply the average pull:</p>
          \[ \frac{dL}{db} = \frac{(p_1 - y_1) + \dots + (p_n - y_n)}{n} \]
          <p>Write <code>gradient_b(pls)</code>.</p>`,
        starter: R`def gradient_b(pls):
    # average pull
    return 0`,
        hint: R`<code>return sum(pls) / len(pls)</code>`,
        solution: R`def gradient_b(pls):
    # average pull
    return sum(pls) / len(pls)`,
        tests: [
          { name: 'round 1: the pulls cancel out', check: R`r = gradient_b([-0.5, 0.5]); assert close(r, 0, 1e-9), f"got {r}, expected 0"` },
          { name: 'average of the pulls', check: R`r = gradient_b([0.2, 0.4, 0.6]); assert close(r, 0.4, 1e-9), f"got {r}, expected 0.4"` },
        ],
      },
      {
        id: 'step',
        title: 'Take one step',
        brief: R`<p>One round of gradient descent, with the same update rule as Lesson 1:</p>
          \[ w_{\text{new}} = w - \eta \times \frac{dL}{dw} \qquad b_{\text{new}} = b - \eta \times \frac{dL}{db} \]
          <p>The first line is written for you. Add the slopes and the update, and return the new <code>w, b</code>.</p>`,
        starter: R`def step(w, b, xs, ys, lr):
    # One round of gradient descent. Return the new (w, b).
    pls = pulls(predict_proba(w, b, xs), ys)

    return w, b`,
        hint: R`<code>dw = gradient_w(xs, pls)</code>, <code>db = gradient_b(pls)</code>, then <code>return w - lr * dw, b - lr * db</code>.`,
        solution: R`def step(w, b, xs, ys, lr):
    # One round of gradient descent. Return the new (w, b).
    pls = pulls(predict_proba(w, b, xs), ys)
    dw = gradient_w(xs, pls)
    db = gradient_b(pls)
    return w - lr * dw, b - lr * db`,
        tests: [
          { name: 'one step from (0, 0) with η = 1 reaches (0.5, 0)', check: R`nw, nb = step(0, 0, xs, ys, 1); assert close(nw, 0.5, 1e-9) and close(nb, 0, 1e-9), f"got w = {nw}, b = {nb}, expected w = 0.5, b = 0"` },
          { name: 'the step lowers the loss', check: R`nw, nb = step(0, 0, xs, ys, 1); assert log_loss(nw, nb, xs, ys) < log_loss(0, 0, xs, ys), "the loss went up. Check the minus signs"` },
        ],
      },
      {
        id: 'train',
        title: 'Repeat',
        brief: R`<p>Training is <code>step</code> in a loop, starting from \(w = 0\), \(b = 0\).</p>
          <p>These two points can be split perfectly, so \(w\) keeps growing the longer you train, and the model grows more and more sure.</p>`,
        starter: R`def train(xs, ys, lr, steps):
    # Start at w = 0, b = 0, then call step() once per step.
    w, b = 0, 0

    return w, b`,
        hint: R`<code>for _ in range(steps):</code> then, indented, <code>w, b = step(w, b, xs, ys, lr)</code>.`,
        solution: R`def train(xs, ys, lr, steps):
    # Start at w = 0, b = 0, then call step() once per step.
    w, b = 0, 0
    for _ in range(steps):
        w, b = step(w, b, xs, ys, lr)
    return w, b`,
        tests: [
          { name: 'zero steps leaves no opinion', check: R`r = train(xs, ys, 1, 0); assert tuple(r) == (0, 0), f"got {r}, expected (0, 0)"` },
          { name: 'one step matches step()', check: R`w, b = train(xs, ys, 1, 1); assert close(w, 0.5, 1e-9) and close(b, 0, 1e-9), f"got w = {w}, b = {b}"` },
          { name: 'more training, more confidence', check: R`w10, _ = train(xs, ys, 1, 10); w100, _ = train(xs, ys, 1, 100); assert 0.5 < w10 < w100, f"w after 10 steps = {w10:.3f}, after 100 = {w100:.3f}; it should keep growing"` },
        ],
      },
      {
        id: 'use',
        title: 'Put it to work',
        brief: R`<p>Now real data: hours studied, and whether each student passed the exam (1) or not (0). The answers overlap between 2.5 and 4 hours, so no model can be certain there.</p>
          <p>Train with a learning rate of <code>0.5</code> for <code>5000</code> steps. Then compute the chance of passing after <code>4.5</code> hours, and the number of hours where passing and failing are equally likely, \(x = -b \div w\). Replace the three placeholder lines.</p>`,
        starter: R`# Hours studied, and whether each student passed (1) or not (0)
hours  = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]
passed = [0,   0, 0,   0, 1,   0, 1,   0, 1,   1, 1,   1]

w, b = 0, 0        # replace: train on hours and passed
chance = 0         # replace: probability of passing after 4.5 hours
tipping = 0        # replace: hours where p = 0.5, that is -b / w

print(f"learned: z = {w:.3f} * hours {b:+.3f}")
print(f"4.5 hours of study: {chance:.0%} chance of passing")
print(f"below {tipping:.2f} hours, failing is more likely than passing")`,
        hint: R`<code>w, b = train(hours, passed, 0.5, 5000)</code>, <code>chance = sigmoid(score(w, b, 4.5))</code>, <code>tipping = -b / w</code>.`,
        solution: R`# Hours studied, and whether each student passed (1) or not (0)
hours  = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]
passed = [0,   0, 0,   0, 1,   0, 1,   0, 1,   1, 1,   1]

w, b = train(hours, passed, 0.5, 5000)
chance = sigmoid(score(w, b, 4.5))
tipping = -b / w

print(f"learned: z = {w:.3f} * hours {b:+.3f}")
print(f"4.5 hours of study: {chance:.0%} chance of passing")
print(f"below {tipping:.2f} hours, failing is more likely than passing")`,
        tests: [
          { name: 'the model was trained on the students', check: R`
import math as _m
_w = _b = 0.0
for _ in range(60):
    _p = [1 / (1 + _m.exp(-(_w * x + _b))) for x in hours]
    _d = [p - y for p, y in zip(_p, passed)]; _n = len(hours)
    _gw = sum(d * x for d, x in zip(_d, hours)) / _n; _gb = sum(_d) / _n
    _s = [p * (1 - p) for p in _p]
    _hww = sum(s * x * x for s, x in zip(_s, hours)) / _n; _hwb = sum(s * x for s, x in zip(_s, hours)) / _n; _hbb = sum(_s) / _n
    _det = _hww * _hbb - _hwb * _hwb
    _w, _b = _w - (_hbb * _gw - _hwb * _gb) / _det, _b - (-_hwb * _gw + _hww * _gb) / _det
assert close(w, _w, 0.05) and close(b, _b, 0.1), f"w = {w:.3f}, b = {b:.3f}. The best model is w = {_w:.3f}, b = {_b:.3f}. Did you train for 5000 steps with lr = 0.5?"` },
          { name: 'chance is the probability for 4.5 hours', check: R`assert close(chance, sigmoid(score(w, b, 4.5)), 1e-6) and 0.5 < chance < 1, f"chance is {chance}, expected sigmoid(score(w, b, 4.5)) = {sigmoid(score(w, b, 4.5)):.3f}"` },
          { name: 'tipping point is −b ÷ w', check: R`assert w != 0 and close(tipping, -b / w, 1e-6), f"tipping is {tipping}, expected −b / w"` },
          { name: 'at the tipping point the model says 0.5', check: R`assert close(sigmoid(score(w, b, tipping)), 0.5, 1e-6), "the probability at the tipping point should be exactly 0.5"` },
        ],
      },
    ],
  };
})();
