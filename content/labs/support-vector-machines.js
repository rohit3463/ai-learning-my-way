// Coding lab for the Support Vector Machines lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter code, hint, solution,
// and tests. A test is { name, check } where check is Python that raises AssertionError on failure.
// Tests run after all earlier steps' code, so every function written so far is available.
// close(a, b, tol=0.01) is provided for comparing decimals.
(() => {
  const R = String.raw;
  window.LABS = window.LABS || {};
  window.LABS['support-vector-machines'] = {
    file: 'svm.py',
    title: 'Write a support vector machine from scratch',
    intro: R`Twelve small steps. You will measure margins, build the hinge cost, and train a linear SVM with gradient descent, the same loop you already know. It ends by sorting apples from oranges. Plain Python, no libraries.`,
    doneTitle: 'You wrote a support vector machine from scratch.',
    doneText: 'Every line below is yours: scores, margins, the hinge cost, the penalty that widens the street, the gradients and the training loop. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your support vector machine works.',
    steps: [
      {
        id: 'data',
        title: 'Store the points',
        brief: R`<p>The four points from the worked example, each with two measurements and a label of \(+1\) or \(-1\):</p>
          <ul><li>A \((2, 2)\) and B \((3, 1)\): label \(+1\)</li><li>C \((0, 0)\) and D \((1, -1)\): label \(-1\)</li></ul>
          <p>Store the points as pairs in a list called <code>X</code>, in the order A, B, C, D, and the labels in <code>ys</code>.</p>`,
        starter: R`# The four points from the worked example
X = []
ys = []`,
        hint: R`Each point is a pair in round brackets: <code>X = [(2, 2), (3, 1), (0, 0), (1, -1)]</code>.`,
        solution: R`# The four points from the worked example
X = [(2, 2), (3, 1), (0, 0), (1, -1)]
ys = [1, 1, -1, -1]`,
        tests: [
          { name: 'X holds A, B, C, D', check: R`assert [tuple(p) for p in X] == [(2, 2), (3, 1), (0, 0), (1, -1)], f"X is {X!r}"` },
          { name: 'labels are +1, +1, −1, −1', check: R`assert list(ys) == [1, 1, -1, -1], f"ys is {ys!r}. SVMs use +1 and −1, not 1 and 0"` },
        ],
      },
      {
        id: 'score',
        title: 'The score',
        brief: R`<p>With two measurements the score has one weight per measurement:</p>
          \[ z = w_1 \times x_1 + w_2 \times x_2 + b \]
          <p>Write <code>score(w, b, x)</code>. Here <code>w</code> is a list <code>[w1, w2]</code> and <code>x</code> is a pair, so the first measurement is <code>x[0]</code>.</p>`,
        starter: R`def score(w, b, x):
    # z = w1 * x1 + w2 * x2 + b
    return 0`,
        hint: R`<code>return w[0] * x[0] + w[1] * x[1] + b</code>`,
        solution: R`def score(w, b, x):
    # z = w1 * x1 + w2 * x2 + b
    return w[0] * x[0] + w[1] * x[1] + b`,
        tests: [
          { name: 'score([1, 2], 3, (4, 5)) is 17', check: R`r = score([1, 2], 3, (4, 5)); assert r == 17, f"got {r}, expected 1 × 4 + 2 × 5 + 3 = 17"` },
          { name: 'the best border scores A as 1', check: R`r = score([0.5, 0.5], -1, (2, 2)); assert close(r, 1), f"got {r}, expected 1"` },
        ],
      },
      {
        id: 'margin',
        title: 'The margin',
        brief: R`<p>Multiply the score by the label. The result is positive when the point is on its own side:</p>
          \[ m = y \times z \]
          <p>Write <code>margin(w, b, x, y)</code>.</p>`,
        starter: R`def margin(w, b, x, y):
    # m = y * z
    return 0`,
        hint: R`<code>return y * score(w, b, x)</code>`,
        solution: R`def margin(w, b, x, y):
    # m = y * z
    return y * score(w, b, x)`,
        tests: [
          { name: 'on the best border, every point has margin 1', check: R`r = [margin([0.5, 0.5], -1, x, y) for x, y in zip(X, ys)]; assert all(close(m, 1) for m in r), f"got {r}, expected all 1"` },
          { name: 'wrong side gives a negative margin', check: R`r = margin([0.5, 0.5], -1, (0, 0), 1); assert close(r, -1), f"got {r}. A +1 point with score −1 is on the wrong side"` },
        ],
      },
      {
        id: 'hinge',
        title: 'The hinge cost',
        brief: R`<p>A point is safe when its margin is at least 1. Safe points cost nothing. Everyone else pays how far they fall short:</p>
          \[ \text{cost} = \max(0,\ 1 - m) \]
          <p>Write <code>hinge(m)</code>.</p>`,
        starter: R`def hinge(m):
    # cost = max(0, 1 - m)
    return 0`,
        hint: R`Python has <code>max</code> built in: <code>return max(0, 1 - m)</code>.`,
        solution: R`def hinge(m):
    # cost = max(0, 1 - m)
    return max(0, 1 - m)`,
        tests: [
          { name: 'safe points cost nothing', check: R`assert hinge(1) == 0 and hinge(2.5) == 0, f"hinge(1) = {hinge(1)}, hinge(2.5) = {hinge(2.5)}, expected 0 and 0"` },
          { name: 'inside the street costs a little', check: R`r = hinge(0.4); assert close(r, 0.6), f"got {r}, expected 0.6"` },
          { name: 'the wrong side costs more than 1', check: R`r = hinge(-1); assert close(r, 2), f"got {r}, expected 2"` },
        ],
      },
      {
        id: 'penalty',
        title: 'The push for a wide street',
        brief: R`<p>The street's width is \(2 \div \sqrt{w_1^2 + w_2^2}\), so smaller weights mean a wider street. We add a small penalty for big weights:</p>
          \[ \text{penalty} = \lambda \times (w_1^2 + w_2^2) \]
          <p>Write <code>penalty(w, lam)</code>. (<code>lambda</code> is a reserved word in Python, so we call \(\lambda\) <code>lam</code>.)</p>`,
        starter: R`def penalty(w, lam):
    # lam * (w1^2 + w2^2)
    return 0`,
        hint: R`<code>return lam * (w[0] ** 2 + w[1] ** 2)</code>`,
        solution: R`def penalty(w, lam):
    # lam * (w1^2 + w2^2)
    return lam * (w[0] ** 2 + w[1] ** 2)`,
        tests: [
          { name: 'penalty([0.1, 0.1], 0.05) is 0.001', check: R`r = penalty([0.1, 0.1], 0.05); assert close(r, 0.001, 1e-9), f"got {r}, expected 0.05 × (0.01 + 0.01) = 0.001"` },
          { name: 'zero weights, zero penalty', check: R`r = penalty([0, 0], 0.05); assert r == 0, f"got {r}"` },
          { name: 'negative weights are penalised too', check: R`r = penalty([-2, 0], 1); assert close(r, 4), f"got {r}, expected 4. Square the weights"` },
        ],
      },
      {
        id: 'loss',
        title: 'Score the whole model',
        brief: R`<p>The loss adds the penalty to the average hinge cost:</p>
          \[ L = \lambda \times (w_1^2 + w_2^2) + \frac{\text{cost}_1 + \dots + \text{cost}_n}{n} \]
          <p>Write <code>loss(w, b, X, ys, lam)</code>.</p>`,
        starter: R`def loss(w, b, X, ys, lam):
    # penalty + average hinge cost
    return 0`,
        hint: R`<code>costs = [hinge(margin(w, b, x, y)) for x, y in zip(X, ys)]</code>, then <code>return penalty(w, lam) + sum(costs) / len(costs)</code>.`,
        solution: R`def loss(w, b, X, ys, lam):
    # penalty + average hinge cost
    costs = [hinge(margin(w, b, x, y)) for x, y in zip(X, ys)]
    return penalty(w, lam) + sum(costs) / len(costs)`,
        tests: [
          { name: 'round 1: no opinion costs 1.000', check: R`r = loss([0, 0], 0, X, ys, 0.05); assert close(r, 1.0, 1e-9), f"got {r}, expected 1.000"` },
          { name: 'round 2 costs 0.801', check: R`r = loss([0.1, 0.1], 0, X, ys, 0.05); assert close(r, 0.801, 1e-6), f"got {r}, expected 0.8 + 0.001 = 0.801"` },
          { name: 'the best street costs only its penalty', check: R`r = loss([0.5, 0.5], -1, X, ys, 0.05); assert close(r, 0.025, 1e-6), f"got {r}, expected 0.025"` },
        ],
      },
      {
        id: 'pulling',
        title: 'Who is still pulling?',
        brief: R`<p>Only points with a margin below 1 (inside the street or on the wrong side) push the border. Safe points are ignored.</p>
          <p>Write <code>pulling(w, b, X, ys)</code> that returns the <strong>positions</strong> (0, 1, 2, …) of the points whose margin is less than 1.</p>`,
        starter: R`def pulling(w, b, X, ys):
    # positions of points with margin < 1
    return []`,
        hint: R`<code>return [i for i, (x, y) in enumerate(zip(X, ys)) if margin(w, b, x, y) < 1]</code>`,
        solution: R`def pulling(w, b, X, ys):
    # positions of points with margin < 1
    return [i for i, (x, y) in enumerate(zip(X, ys)) if margin(w, b, x, y) < 1]`,
        tests: [
          { name: 'with no opinion, everyone pulls', check: R`r = pulling([0, 0], 0, X, ys); assert list(r) == [0, 1, 2, 3], f"got {r}, expected [0, 1, 2, 3]"` },
          { name: 'on the best street, nobody pulls', check: R`r = pulling([0.5, 0.5], -1, X, ys); assert list(r) == [], f"got {r}. Margins of exactly 1 are safe"` },
          { name: 'only the point too close pulls', check: R`r = pulling([1, 1], -3.5, X, ys); assert list(r) == [0, 1], f"got {r}, expected [0, 1]"` },
        ],
      },
      {
        id: 'gradient_w',
        title: 'The slopes for the weights',
        brief: R`<p>Each weight feels two things: the penalty, which pulls it toward zero, and every point still pulling:</p>
          \[ \frac{dL}{dw_j} = 2\lambda \times w_j - \frac{\text{sum of } y \times x_j \text{ over the pulling points}}{n} \]
          <p>Here \(n\) counts <em>all</em> the points. Write <code>gradient_w(w, b, X, ys, lam)</code> that returns <code>[g1, g2]</code>.</p>`,
        starter: R`def gradient_w(w, b, X, ys, lam):
    # [dL/dw1, dL/dw2]
    g = [2 * lam * w[0], 2 * lam * w[1]]

    return g`,
        hint: R`Loop <code>for i in pulling(w, b, X, ys):</code> and subtract <code>ys[i] * X[i][0] / len(X)</code> from <code>g[0]</code>, and the same with <code>X[i][1]</code> for <code>g[1]</code>.`,
        solution: R`def gradient_w(w, b, X, ys, lam):
    # [dL/dw1, dL/dw2]
    g = [2 * lam * w[0], 2 * lam * w[1]]
    for i in pulling(w, b, X, ys):
        g[0] -= ys[i] * X[i][0] / len(X)
        g[1] -= ys[i] * X[i][1] / len(X)
    return g`,
        tests: [
          { name: 'round 1 slopes are [−1, −1]', check: R`r = gradient_w([0, 0], 0, X, ys, 0.05); assert close(r[0], -1, 1e-9) and close(r[1], -1, 1e-9), f"got {r}, expected [-1, -1]"` },
          { name: 'with nobody pulling, only the penalty is left', check: R`r = gradient_w([0.5, 0.5], -1, X, ys, 0.05); assert close(r[0], 0.05, 1e-9) and close(r[1], 0.05, 1e-9), f"got {r}, expected [0.05, 0.05] = 2 × 0.05 × 0.5"` },
        ],
      },
      {
        id: 'gradient_b',
        title: 'The slope for b',
        brief: R`<p>\(b\) has no penalty, only the pulls:</p>
          \[ \frac{dL}{db} = -\frac{\text{sum of } y \text{ over the pulling points}}{n} \]
          <p>Write <code>gradient_b(w, b, X, ys)</code>.</p>`,
        starter: R`def gradient_b(w, b, X, ys):
    # -(sum of y over pulling points) / n
    return 0`,
        hint: R`<code>return -sum(ys[i] for i in pulling(w, b, X, ys)) / len(X)</code>`,
        solution: R`def gradient_b(w, b, X, ys):
    # -(sum of y over pulling points) / n
    return -sum(ys[i] for i in pulling(w, b, X, ys)) / len(X)`,
        tests: [
          { name: 'round 1: the pulls cancel out', check: R`r = gradient_b([0, 0], 0, X, ys); assert close(r, 0, 1e-9), f"got {r}, expected 0"` },
          { name: 'two +1 points pulling push b up', check: R`r = gradient_b([1, 1], -3.5, X, ys); assert close(r, -0.5, 1e-9), f"got {r}, expected −(1 + 1) / 4 = −0.5"` },
        ],
      },
      {
        id: 'step',
        title: 'Take one step',
        brief: R`<p>The same update as in every lesson so far, applied to all three numbers:</p>
          \[ w_j \leftarrow w_j - \eta \times \frac{dL}{dw_j} \qquad b \leftarrow b - \eta \times \frac{dL}{db} \]
          <p>Write <code>step</code> so it returns the new weights as a list and the new <code>b</code>.</p>`,
        starter: R`def step(w, b, X, ys, lam, lr):
    # One round of gradient descent. Return ([w1, w2], b).
    gw = gradient_w(w, b, X, ys, lam)
    gb = gradient_b(w, b, X, ys)

    return w, b`,
        hint: R`<code>return [w[0] - lr * gw[0], w[1] - lr * gw[1]], b - lr * gb</code>`,
        solution: R`def step(w, b, X, ys, lam, lr):
    # One round of gradient descent. Return ([w1, w2], b).
    gw = gradient_w(w, b, X, ys, lam)
    gb = gradient_b(w, b, X, ys)
    return [w[0] - lr * gw[0], w[1] - lr * gw[1]], b - lr * gb`,
        tests: [
          { name: 'one step reaches w = [0.1, 0.1], b = 0', check: R`nw, nb = step([0, 0], 0, X, ys, 0.05, 0.1); assert close(nw[0], 0.1, 1e-9) and close(nw[1], 0.1, 1e-9) and close(nb, 0, 1e-9), f"got w = {nw}, b = {nb}"` },
          { name: 'the step lowers the loss', check: R`nw, nb = step([0, 0], 0, X, ys, 0.05, 0.1); assert loss(nw, nb, X, ys, 0.05) < loss([0, 0], 0, X, ys, 0.05), "the loss went up. Check the minus signs"` },
        ],
      },
      {
        id: 'train',
        title: 'Find the widest street',
        brief: R`<p>Loop <code>step</code> from \(w = [0, 0]\), \(b = 0\).</p>
          <p>For these four points the widest street has its middle line at \(x_1 + x_2 = 2\), that is \(w = [0.5, 0.5]\) and \(b = -1\), and it is \(2.83\) wide. With \(\lambda = 0.05\), a learning rate of 0.1 and 1000 steps, you should land close to it.</p>`,
        starter: R`def train(X, ys, lam, lr, steps):
    # Start at w = [0, 0], b = 0, then call step() once per step.
    w, b = [0, 0], 0

    return w, b

w, b = train(X, ys, 0.05, 0.1, 1000)
print("w =", [round(v, 3) for v in w], " b =", round(b, 3))`,
        hint: R`<code>for _ in range(steps):</code> then, indented, <code>w, b = step(w, b, X, ys, lam, lr)</code>.`,
        solution: R`def train(X, ys, lam, lr, steps):
    # Start at w = [0, 0], b = 0, then call step() once per step.
    w, b = [0, 0], 0
    for _ in range(steps):
        w, b = step(w, b, X, ys, lam, lr)
    return w, b

w, b = train(X, ys, 0.05, 0.1, 1000)
print("w =", [round(v, 3) for v in w], " b =", round(b, 3))`,
        tests: [
          { name: 'one step matches step()', check: R`_w, _b = train(X, ys, 0.05, 0.1, 1); assert close(_w[0], 0.1, 1e-9) and close(_b, 0, 1e-9), f"got w = {_w}, b = {_b}"` },
          { name: '1000 steps find the widest street', check: R`_w, _b = train(X, ys, 0.05, 0.1, 1000); assert close(_w[0], 0.5, 0.05) and close(_w[1], 0.5, 0.05) and close(_b, -1, 0.06), f"got w = {[round(v, 3) for v in _w]}, b = {_b:.3f}, expected about [0.5, 0.5] and −1"` },
          { name: 'every point ends up safe', check: R`_w, _b = train(X, ys, 0.05, 0.1, 1000); assert all(margin(_w, _b, x, y) > 0.95 for x, y in zip(X, ys)), "some point is still inside the street"` },
        ],
      },
      {
        id: 'use',
        title: 'Put it to work',
        brief: R`<p>Sort fruit by two measurements: size (cm) and redness (0 to 10). Apples are \(+1\), oranges are \(-1\).</p>
          <p>Train with \(\lambda = 0.01\), a learning rate of <code>0.02</code> and <code>5000</code> steps. Then compute the street's width, \(2 \div \sqrt{w_1^2 + w_2^2}\), and classify a new fruit of size 7.2 and redness 6.0: it is an apple when its score is positive. Replace the three placeholder lines.</p>`,
        starter: R`# (size in cm, redness from 0 to 10). Apples are +1, oranges are -1.
fruit = [(7.0, 8.5), (6.5, 9.0), (7.5, 7.8), (8.0, 8.8), (6.8, 7.2),
         (8.5, 3.0), (9.0, 2.5), (8.0, 3.8), (9.5, 3.2), (7.8, 4.2)]
kind  = [1, 1, 1, 1, 1, -1, -1, -1, -1, -1]

w, b = [0, 0], 0     # replace: train on fruit and kind
width = 0            # replace: 2 / sqrt(w1^2 + w2^2)
guess = "?"          # replace: "apple" or "orange" for (7.2, 6.0)

print("border:", [round(v, 3) for v in w], round(b, 3))
print("street width:", round(width, 2))
print("support vectors:", [i for i, (x, y) in enumerate(zip(fruit, kind)) if margin(w, b, x, y) < 1.1])
print("a fruit of size 7.2 and redness 6.0 is probably an", guess)`,
        hint: R`<code>w, b = train(fruit, kind, 0.01, 0.02, 5000)</code>, <code>width = 2 / (w[0] ** 2 + w[1] ** 2) ** 0.5</code>, and <code>guess = "apple" if score(w, b, (7.2, 6.0)) > 0 else "orange"</code>.`,
        solution: R`# (size in cm, redness from 0 to 10). Apples are +1, oranges are -1.
fruit = [(7.0, 8.5), (6.5, 9.0), (7.5, 7.8), (8.0, 8.8), (6.8, 7.2),
         (8.5, 3.0), (9.0, 2.5), (8.0, 3.8), (9.5, 3.2), (7.8, 4.2)]
kind  = [1, 1, 1, 1, 1, -1, -1, -1, -1, -1]

w, b = train(fruit, kind, 0.01, 0.02, 5000)
width = 2 / (w[0] ** 2 + w[1] ** 2) ** 0.5
guess = "apple" if score(w, b, (7.2, 6.0)) > 0 else "orange"

print("border:", [round(v, 3) for v in w], round(b, 3))
print("street width:", round(width, 2))
print("support vectors:", [i for i, (x, y) in enumerate(zip(fruit, kind)) if margin(w, b, x, y) < 1.1])
print("a fruit of size 7.2 and redness 6.0 is probably an", guess)`,
        tests: [
          { name: 'the model was trained on the fruit', check: R`_w, _b = train(fruit, kind, 0.01, 0.02, 5000); assert close(w[0], _w[0], 1e-6) and close(w[1], _w[1], 1e-6) and close(b, _b, 1e-6), f"w = {w}, b = {b}. Train with lam = 0.01, lr = 0.02 and 5000 steps"` },
          { name: 'every fruit is on its own side', check: R`assert all(margin(w, b, x, y) > 0 for x, y in zip(fruit, kind)), "some fruit is on the wrong side of the border"` },
          { name: 'width is 2 ÷ √(w₁² + w₂²)', check: R`assert close(width, 2 / (w[0] ** 2 + w[1] ** 2) ** 0.5, 1e-6) and width > 1, f"width is {width}"` },
          { name: 'the new fruit is classified by its score', check: R`_e = "apple" if score(w, b, (7.2, 6.0)) > 0 else "orange"; assert guess == _e, f"guess is {guess!r}, expected {_e!r}"` },
        ],
      },
    ],
  };
})();
