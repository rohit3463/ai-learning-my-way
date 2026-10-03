// Coding lab for the Linear Regression lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter code, hint, solution,
// and tests. A test is { name, check } where check is Python that raises AssertionError on failure.
// Tests run after all earlier steps' code, so every function written so far is available.
// close(a, b, tol=0.01) is provided for comparing decimals.
(() => {
  const R = String.raw;
  // The lab's finished functions, given to the exercises as read-only code.
  const BASE = ['data', 'predict', 'predict_all', 'errors', 'mse', 'loss', 'gradient_w', 'gradient_b', 'step', 'train'];
  const NOTE = String.raw`<p class="ide-note">The first run downloads scikit-learn into your browser (about 40 MB, once). It can take up to a minute; later runs are instant.</p>`;
  window.LABS = window.LABS || {};
  window.LABS['linear-regression'] = {
    file: 'linear_regression.py',
    title: 'Write linear regression from scratch',
    doneTitle: 'You wrote linear regression from scratch.',
    doneText: 'Every line below is yours: data, predictions, errors, loss, gradients, and the training loop. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your linear regression works.',
    intro: R`Thirteen small steps, one or two ideas at a time. Write each piece, run its tests, and move on. At the end you will have a working program that learns a line from data, in plain Python with no libraries. The last step checks your work against scikit-learn, the library used in practice.`,
    steps: [
      {
        id: 'data',
        title: 'Store the points',
        brief: R`<p>Every model starts with data. Use the three points from the worked example: \((1, 2)\), \((2, 3)\) and \((3, 5)\).</p>
          <p>Store the \(x\) values in a list called <code>xs</code> and the \(y\) values in a list called <code>ys</code>, in the same order.</p>`,
        starter: R`# The three points from the worked example
xs = []
ys = []`,
        hint: R`A Python list is written with square brackets: <code>[1, 2, 3]</code>.`,
        solution: R`# The three points from the worked example
xs = [1, 2, 3]
ys = [2, 3, 5]`,
        tests: [
          { name: 'xs holds 1, 2, 3', check: R`assert list(xs) == [1, 2, 3], f"xs is {xs!r}, expected [1, 2, 3]"` },
          { name: 'ys holds 2, 3, 5', check: R`assert list(ys) == [2, 3, 5], f"ys is {ys!r}, expected [2, 3, 5]"` },
        ],
      },
      {
        id: 'predict',
        title: 'Predict one point',
        brief: R`<p>The model is a straight line:</p>
          \[ \hat{y} = w \times x + b \]
          <p>Write <code>predict(w, b, x)</code> so it returns the line's guess for a single \(x\).</p>`,
        starter: R`def predict(w, b, x):
    # The line's guess for one x:  y_hat = w * x + b
    return 0`,
        hint: R`One line: <code>return w * x + b</code>.`,
        solution: R`def predict(w, b, x):
    # The line's guess for one x:  y_hat = w * x + b
    return w * x + b`,
        tests: [
          { name: 'predict(2, 1, 3) is 7', check: R`r = predict(2, 1, 3); assert r == 7, f"got {r}. With w = 2, b = 1, x = 3 the line gives 2 × 3 + 1 = 7"` },
          { name: 'predict(0, 0, 5) is 0', check: R`r = predict(0, 0, 5); assert r == 0, f"got {r}. A flat line through zero predicts 0 everywhere"` },
          { name: 'predict(0.5, -1, 4) is 1.0', check: R`r = predict(0.5, -1, 4); assert close(r, 1.0), f"got {r}, expected 0.5 × 4 − 1 = 1.0"` },
        ],
      },
      {
        id: 'predict_all',
        title: 'Predict every point',
        brief: R`<p>We need a prediction for every point, not just one.</p>
          <p>Write <code>predict_all(w, b, xs)</code> that returns a list with one prediction per \(x\). Reuse <code>predict</code>.</p>`,
        starter: R`def predict_all(w, b, xs):
    # One prediction per x, in the same order. Use predict().
    return []`,
        hint: R`A list comprehension does it in one line: <code>return [predict(w, b, x) for x in xs]</code>.`,
        solution: R`def predict_all(w, b, xs):
    # One prediction per x, in the same order. Use predict().
    return [predict(w, b, x) for x in xs]`,
        tests: [
          { name: 'one prediction per point', check: R`r = predict_all(1, 1, xs); assert len(r) == len(xs), f"got {len(r)} predictions for {len(xs)} points"` },
          { name: 'w = 0, b = 0 predicts zeros', check: R`r = predict_all(0, 0, xs); assert list(r) == [0, 0, 0], f"got {r}, expected [0, 0, 0]"` },
          { name: 'w = 1, b = 1 gives [2, 3, 4]', check: R`r = predict_all(1, 1, [1, 2, 3]); assert list(r) == [2, 3, 4], f"got {r}, expected [2, 3, 4]"` },
        ],
      },
      {
        id: 'errors',
        title: 'Measure each miss',
        brief: R`<p>For every point, the error is the true answer minus the guess:</p>
          \[ e = y - \hat{y} \]
          <p>Write <code>errors(ys, preds)</code> that returns one error per point. Keep the order: \(y\) first, then subtract the prediction.</p>`,
        starter: R`def errors(ys, preds):
    # One error per point:  e = y - y_hat
    return []`,
        hint: R`Walk through both lists together with <code>zip</code>: <code>return [y - p for y, p in zip(ys, preds)]</code>.`,
        solution: R`def errors(ys, preds):
    # One error per point:  e = y - y_hat
    return [y - p for y, p in zip(ys, preds)]`,
        tests: [
          { name: 'round 1 errors are [2, 3, 5]', check: R`r = errors([2, 3, 5], [0, 0, 0]); assert list(r) == [2, 3, 5], f"got {r}, expected [2, 3, 5]"` },
          { name: 'y minus prediction, not the other way', check: R`r = errors([1], [3]); assert list(r) == [-2], f"got {r}. The point is below the line, so the error should be 1 − 3 = −2"` },
          { name: 'round 2 errors match the table', check: R`r = errors([2, 3, 5], [1.1, 1.867, 2.633]); assert all(close(a, b) for a, b in zip(r, [0.9, 1.133, 2.367])), f"got {r}"` },
        ],
      },
      {
        id: 'mse',
        title: 'Turn the misses into one number',
        brief: R`<p>Square each error and take the average. This is the mean squared error:</p>
          \[ L = \frac{e_1^2 + e_2^2 + \dots + e_n^2}{n} \]
          <p>Write <code>mse(errs)</code>.</p>`,
        starter: R`def mse(errs):
    # Average of the squared errors
    return 0`,
        hint: R`<code>sum(e * e for e in errs)</code> adds up the squares. Divide by <code>len(errs)</code>.`,
        solution: R`def mse(errs):
    # Average of the squared errors
    return sum(e * e for e in errs) / len(errs)`,
        tests: [
          { name: 'mse([2, 3, 5]) is 12.67', check: R`r = mse([2, 3, 5]); assert close(r, 12.667), f"got {r}, expected (4 + 9 + 25) / 3 = 12.667"` },
          { name: 'squaring makes misses positive', check: R`r = mse([-2]); assert close(r, 4), f"got {r}. An error of −2 should cost 4"` },
          { name: 'no errors, no loss', check: R`r = mse([0, 0, 0]); assert r == 0, f"got {r}, expected 0"` },
        ],
      },
      {
        id: 'loss',
        title: 'Score a whole line',
        brief: R`<p>Chain the pieces together: predictions, then errors, then the mean squared error.</p>
          <p>Write <code>loss(w, b, xs, ys)</code> that returns the loss of the line with slope \(w\) and intercept \(b\).</p>`,
        starter: R`def loss(w, b, xs, ys):
    # predictions -> errors -> mean squared error
    return 0`,
        hint: R`Two lines: <code>errs = errors(ys, predict_all(w, b, xs))</code>, then <code>return mse(errs)</code>.`,
        solution: R`def loss(w, b, xs, ys):
    # predictions -> errors -> mean squared error
    errs = errors(ys, predict_all(w, b, xs))
    return mse(errs)`,
        tests: [
          { name: 'starting line (0, 0) has loss 12.67', check: R`r = loss(0, 0, xs, ys); assert close(r, 12.667), f"got {r}, expected 12.667"` },
          { name: 'after one step (0.767, 0.333) the loss is 2.57', check: R`r = loss(0.767, 0.333, xs, ys); assert close(r, 2.565, 0.02), f"got {r}, expected about 2.57"` },
          { name: 'the best line (1.5, 0.333) has loss 0.056', check: R`r = loss(1.5, 1/3, xs, ys); assert close(r, 0.0556, 0.005), f"got {r}, expected about 0.056"` },
        ],
      },
      {
        id: 'gradient_w',
        title: 'The slope for w',
        brief: R`<p>Which way should \(w\) move? The slope of the loss with respect to \(w\) is</p>
          \[ \frac{dL}{dw} = -2 \times \frac{x_1 e_1 + x_2 e_2 + \dots + x_n e_n}{n} \]
          <p>Write <code>gradient_w(xs, errs)</code>.</p>`,
        starter: R`def gradient_w(xs, errs):
    # dL/dw = -2 * (x1*e1 + x2*e2 + ... + xn*en) / n
    return 0`,
        hint: R`<code>sum(x * e for x, e in zip(xs, errs))</code> gives the top of the fraction.`,
        solution: R`def gradient_w(xs, errs):
    # dL/dw = -2 * (x1*e1 + x2*e2 + ... + xn*en) / n
    return -2 * sum(x * e for x, e in zip(xs, errs)) / len(xs)`,
        tests: [
          { name: 'round 1 slope is −15.33', check: R`r = gradient_w([1, 2, 3], [2, 3, 5]); assert close(r, -15.333), f"got {r}, expected −2 × (2 + 6 + 15) / 3 = −15.33"` },
          { name: 'no error means a flat slope', check: R`r = gradient_w([1, 2, 3], [0, 0, 0]); assert r == 0, f"got {r}, expected 0"` },
          { name: 'the sign is negative when points sit above the line', check: R`r = gradient_w([1], [1]); assert r < 0, f"got {r}. Did you keep the −2?"` },
        ],
      },
      {
        id: 'gradient_b',
        title: 'The slope for b',
        brief: R`<p>The slope for \(b\) is \(-2\) times the average error:</p>
          \[ \frac{dL}{db} = -2 \times \frac{e_1 + e_2 + \dots + e_n}{n} \]
          <p>Write <code>gradient_b(errs)</code>.</p>`,
        starter: R`def gradient_b(errs):
    # dL/db = -2 * (e1 + e2 + ... + en) / n
    return 0`,
        hint: R`<code>return -2 * sum(errs) / len(errs)</code>`,
        solution: R`def gradient_b(errs):
    # dL/db = -2 * (e1 + e2 + ... + en) / n
    return -2 * sum(errs) / len(errs)`,
        tests: [
          { name: 'round 1 slope is −6.67', check: R`r = gradient_b([2, 3, 5]); assert close(r, -6.667), f"got {r}, expected −2 × (2 + 3 + 5) / 3 = −6.67"` },
          { name: 'balanced errors cancel out', check: R`r = gradient_b([1, -1]); assert r == 0, f"got {r}, expected 0"` },
        ],
      },
      {
        id: 'step',
        title: 'Take one step downhill',
        brief: R`<p>Now put it together into one round of gradient descent. Compute both slopes, then move each number against its slope:</p>
          \[ w_{\text{new}} = w - \eta \times \frac{dL}{dw} \qquad b_{\text{new}} = b - \eta \times \frac{dL}{db} \]
          <p>In code the learning rate \(\eta\) is called <code>lr</code>. The first line is written for you. Add the rest and return the new <code>w, b</code>.</p>`,
        starter: R`def step(w, b, xs, ys, lr):
    # One round of gradient descent. Return the new (w, b).
    errs = errors(ys, predict_all(w, b, xs))

    return w, b`,
        hint: R`Compute <code>dw = gradient_w(xs, errs)</code> and <code>db = gradient_b(errs)</code>, then <code>return w - lr * dw, b - lr * db</code>.`,
        solution: R`def step(w, b, xs, ys, lr):
    # One round of gradient descent. Return the new (w, b).
    errs = errors(ys, predict_all(w, b, xs))
    dw = gradient_w(xs, errs)
    db = gradient_b(errs)
    return w - lr * dw, b - lr * db`,
        tests: [
          { name: 'one step from (0, 0) reaches (0.767, 0.333)', check: R`nw, nb = step(0, 0, xs, ys, 0.05); assert close(nw, 0.767) and close(nb, 0.333), f"got w = {nw:.3f}, b = {nb:.3f}, expected w = 0.767, b = 0.333"` },
          { name: 'the step lowers the loss', check: R`nw, nb = step(0, 0, xs, ys, 0.05); assert loss(nw, nb, xs, ys) < loss(0, 0, xs, ys), "the loss went up. Check the minus signs in the update"` },
          { name: 'a learning rate of 0 changes nothing', check: R`nw, nb = step(0.3, 0.2, xs, ys, 0); assert close(nw, 0.3) and close(nb, 0.2), f"got ({nw}, {nb}), expected (0.3, 0.2)"` },
        ],
      },
      {
        id: 'train',
        title: 'Repeat until it fits',
        brief: R`<p>Training is just <code>step</code> in a loop. Start at \(w = 0\), \(b = 0\) and take <code>steps</code> steps.</p>
          <p>For these three points, the best line is \(w = 1.5\), \(b = 0.333\). With a learning rate of 0.05 and 2000 steps, your training should land there.</p>`,
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
          { name: 'zero steps leaves the starting line', check: R`r = train(xs, ys, 0.05, 0); assert tuple(r) == (0, 0), f"got {r}, expected (0, 0)"` },
          { name: 'one step matches step()', check: R`w, b = train(xs, ys, 0.05, 1); assert close(w, 0.767) and close(b, 0.333), f"got w = {w:.3f}, b = {b:.3f}"` },
          { name: '2000 steps find the best line', check: R`w, b = train(xs, ys, 0.05, 2000); assert close(w, 1.5) and close(b, 0.333), f"got w = {w:.3f}, b = {b:.3f}, expected w = 1.5, b = 0.333"` },
        ],
      },
      {
        id: 'history',
        title: 'Watch the loss fall',
        brief: R`<p>To see learning happen, record the loss along the way.</p>
          <p>Write <code>train_with_history</code>: the same loop as <code>train</code>, but before each step append the current loss to <code>losses</code>. Then print a few of them to see the loss drop.</p>`,
        starter: R`def train_with_history(xs, ys, lr, steps):
    # Like train(), but record the loss before every step.
    w, b = 0, 0
    losses = []

    return w, b, losses

w, b, losses = train_with_history(xs, ys, 0.05, 200)
if losses:
    print("first losses:", [round(l, 3) for l in losses[:4]])
    print("last loss:   ", round(losses[-1], 4))`,
        hint: R`Inside the loop: <code>losses.append(loss(w, b, xs, ys))</code>, then <code>w, b = step(w, b, xs, ys, lr)</code>.`,
        solution: R`def train_with_history(xs, ys, lr, steps):
    # Like train(), but record the loss before every step.
    w, b = 0, 0
    losses = []
    for _ in range(steps):
        losses.append(loss(w, b, xs, ys))
        w, b = step(w, b, xs, ys, lr)
    return w, b, losses

w, b, losses = train_with_history(xs, ys, 0.05, 200)
if losses:
    print("first losses:", [round(l, 3) for l in losses[:4]])
    print("last loss:   ", round(losses[-1], 4))`,
        tests: [
          { name: 'one loss recorded per step', check: R`_w, _b, _l = train_with_history(xs, ys, 0.05, 50); assert len(_l) == 50, f"got {len(_l)} losses for 50 steps"` },
          { name: 'the first loss is 12.67', check: R`_w, _b, _l = train_with_history(xs, ys, 0.05, 5); assert close(_l[0], 12.667), f"the first loss is {_l[0]}. Record the loss before taking the step"` },
          { name: 'the loss never goes up', check: R`_w, _b, _l = train_with_history(xs, ys, 0.05, 300); assert all(a >= b - 1e-12 for a, b in zip(_l, _l[1:])), "the loss rose at some step"` },
        ],
      },
      {
        id: 'use',
        title: 'Put it to work',
        brief: R`<p>Your model is complete. Use it on new data: house sizes (in hundreds of m²) and prices (in hundreds of thousands).</p>
          <p>Train on the houses with a learning rate of <code>0.1</code> for <code>2000</code> steps, then use <code>predict</code> to price a 160 m² house (size <code>1.6</code>). Replace the two placeholder lines.</p>`,
        starter: R`# House sizes (hundreds of m²) and prices (hundreds of thousands)
sizes  = [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.4]
prices = [1.3, 1.9, 2.2, 2.5, 3.1, 3.5, 4.0, 4.6]

w, b = 0, 0      # replace: train on sizes and prices
guess = 0        # replace: predict the price of a size 1.6 house

print(f"learned line: price = {w:.3f} * size + {b:.3f}")
print(f"a 160 m² house: about {guess * 100:.0f} thousand")`,
        hint: R`<code>w, b = train(sizes, prices, 0.1, 2000)</code> and <code>guess = predict(w, b, 1.6)</code>.`,
        solution: R`# House sizes (hundreds of m²) and prices (hundreds of thousands)
sizes  = [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.4]
prices = [1.3, 1.9, 2.2, 2.5, 3.1, 3.5, 4.0, 4.6]

w, b = train(sizes, prices, 0.1, 2000)
guess = predict(w, b, 1.6)

print(f"learned line: price = {w:.3f} * size + {b:.3f}")
print(f"a 160 m² house: about {guess * 100:.0f} thousand")`,
        tests: [
          { name: 'the model was trained on the houses', check: R`
_n = len(sizes); _mx = sum(sizes) / _n; _my = sum(prices) / _n
_bw = sum((x - _mx) * (y - _my) for x, y in zip(sizes, prices)) / sum((x - _mx) ** 2 for x in sizes)
_bb = _my - _bw * _mx
assert close(w, _bw, 0.02) and close(b, _bb, 0.02), f"w = {w:.3f}, b = {b:.3f}. The best line is w = {_bw:.3f}, b = {_bb:.3f}"` },
          { name: 'guess is the prediction for size 1.6', check: R`assert close(guess, predict(w, b, 1.6), 1e-6) and guess > 0, f"guess is {guess}, expected predict(w, b, 1.6) = {predict(w, b, 1.6):.3f}"` },
        ],
      },
      {
        id: 'sklearn', title: 'Check with scikit-learn',
        brief: R`<p>In practice you would use a library. <strong>scikit-learn</strong> fits the same line in one call, solving for the best \(w\) and \(b\) directly, with no learning rate.</p>
          <p>Fit a <code>LinearRegression</code> on <code>xs</code> and <code>ys</code>. It expects the inputs as a table with one row per point, so reshape <code>xs</code> into one column. Then compare its slope (<code>model.coef_[0]</code>) and intercept (<code>model.intercept_</code>) with yours.</p>${NOTE}`,
        starter: R`import numpy as np
from sklearn.linear_model import LinearRegression

model = None   # replace: LinearRegression().fit(...) on xs and ys

w_mine, b_mine = train(xs, ys, 0.05, 2000)
print("mine:        ", round(w_mine, 3), round(b_mine, 3))
if model is not None:
    print("scikit-learn:", round(model.coef_[0], 3), round(model.intercept_, 3))`,
        hint: R`<code>model = LinearRegression().fit(np.array(xs).reshape(-1, 1), ys)</code>`,
        solution: R`import numpy as np
from sklearn.linear_model import LinearRegression

model = LinearRegression().fit(np.array(xs).reshape(-1, 1), ys)

w_mine, b_mine = train(xs, ys, 0.05, 2000)
print("mine:        ", round(w_mine, 3), round(b_mine, 3))
if model is not None:
    print("scikit-learn:", round(model.coef_[0], 3), round(model.intercept_, 3))`,
        tests: [
          { name: 'model is a fitted LinearRegression', check: R`from sklearn.linear_model import LinearRegression as _LR; assert isinstance(model, _LR) and hasattr(model, "coef_"), "fit a LinearRegression on xs and ys"` },
          { name: 'same slope as yours', check: R`assert close(model.coef_[0], w_mine, 0.01), f"scikit-learn {model.coef_[0]:.3f}, yours {w_mine:.3f}"` },
          { name: 'same intercept as yours', check: R`assert close(model.intercept_, b_mine, 0.01), f"scikit-learn {model.intercept_:.3f}, yours {b_mine:.3f}"` },
        ],
      },
    ],
    // Exercises: unguided practice once the lab is done. Each runs after the given code (the lab's own functions).
    exercises: [
      {
        id: 'fix-step',
        type: 'fix',
        title: 'The line that runs away',
        given: BASE,
        brief: R`<p>A teammate rewrote <code>step()</code>, and now the loss goes <em>up</em> on every step until the numbers explode. The functions above it are correct.</p>
          <p>Find what is wrong in their version and fix it. There may be more than one mistake.</p>`,
        starter: R`def step(w, b, xs, ys, lr):
    # A teammate's version of step(). Training with it makes the loss grow.
    errs = errors(ys, predict_all(w, b, xs))
    dw = gradient_w(xs, errs)
    db = gradient_b(errs)
    return w + lr * dw, b - lr * dw`,
        hints: [
          R`Gradient descent moves each number <em>against</em> its slope: new value = old value − learning rate × slope. Check the sign for <code>w</code>.`,
          R`Each number has its own slope. Which slope should <code>b</code> use?`,
          R`<code>return w - lr * dw, b - lr * db</code>`,
        ],
        solution: R`def step(w, b, xs, ys, lr):
    # A teammate's version of step(). Training with it makes the loss grow.
    errs = errors(ys, predict_all(w, b, xs))
    dw = gradient_w(xs, errs)
    db = gradient_b(errs)
    return w - lr * dw, b - lr * db`,
        tests: [
          { name: 'one step lowers the loss', check: R`w, b = step(0, 0, xs, ys, 0.05); assert loss(w, b, xs, ys) < loss(0, 0, xs, ys), f"loss went from {loss(0, 0, xs, ys):.3f} to {loss(w, b, xs, ys):.3f}"` },
          { name: 'w and b move by the right amounts', check: R`w, b = step(0, 0, xs, ys, 0.05); assert close(w, 0.767) and close(b, 0.333), f"got w = {w:.3f}, b = {b:.3f}; expected about 0.767 and 0.333"` },
          { name: 'training finds the best line', check: R`w, b = train(xs, ys, 0.05, 2000); assert close(w, 1.5) and close(b, 0.333), f"got w = {w:.3f}, b = {b:.3f}; expected 1.5 and 0.333"` },
        ],
      },
      {
        id: 'r-squared',
        type: 'extend',
        title: 'How good is the line?',
        given: BASE,
        brief: R`<p>The loss tells you the average squared error, but its size depends on the units of \(y\). A score from 0 to 1 is easier to read. \(R^2\) compares your line with the laziest possible model, a flat line at the average \(\bar{y}\):</p>
          \[ R^2 = 1 - \frac{\text{sum of } (y - \hat{y})^2}{\text{sum of } (y - \bar{y})^2} \]
          <p>Write <code>r_squared(xs, ys, w, b)</code>. A perfect line scores 1; a line no better than the average scores 0.</p>`,
        starter: R`def r_squared(xs, ys, w, b):
    # 1 - (squared errors of the line) / (squared errors of the flat average line)
    return 0`,
        hints: [
          R`You need two sums: the squared errors of your line's predictions, and the squared distances of each \(y\) from the mean of <code>ys</code>.`,
          R`<code>mean_y = sum(ys) / len(ys)</code>. Reuse <code>predict_all</code> and <code>errors</code> for the first sum.`,
          R`<code>sse = sum(e * e for e in errors(ys, predict_all(w, b, xs)))</code>, <code>sst = sum((y - mean_y) ** 2 for y in ys)</code>, then <code>return 1 - sse / sst</code>.`,
        ],
        solution: R`def r_squared(xs, ys, w, b):
    # 1 - (squared errors of the line) / (squared errors of the flat average line)
    mean_y = sum(ys) / len(ys)
    sse = sum(e * e for e in errors(ys, predict_all(w, b, xs)))
    sst = sum((y - mean_y) ** 2 for y in ys)
    return 1 - sse / sst`,
        tests: [
          { name: 'a perfect line scores 1', check: R`r = r_squared([0, 1, 2], [1, 3, 5], 2, 1); assert close(r, 1.0), f"got {r}"` },
          { name: 'the flat average line scores 0', check: R`r = r_squared(xs, ys, 0, 10 / 3); assert close(r, 0.0), f"got {r}"` },
          { name: 'the best line scores 0.964', check: R`r = r_squared(xs, ys, 1.5, 1 / 3); assert close(r, 0.964, 0.002), f"got {r:.4f}"` },
          { name: 'a bad line can score below 0', check: R`r = r_squared(xs, ys, -1, 0); assert r < 0, f"got {r:.3f}: a line worse than the average should score below zero"` },
        ],
      },
      {
        id: 'early-stop',
        type: 'extend',
        title: 'Stop when it stops learning',
        given: BASE,
        brief: R`<p><code>train()</code> always takes a fixed number of steps, even long after the line has stopped moving. Write <code>train_until(xs, ys, lr, tol, max_steps)</code> that starts at \(w = 0, b = 0\) and stops as soon as one step lowers the loss by less than <code>tol</code>, or after <code>max_steps</code> steps.</p>
          <p>Return <code>(w, b, steps_taken)</code>.</p>`,
        starter: R`def train_until(xs, ys, lr, tol, max_steps):
    # Step until the loss improves by less than tol, or max_steps is reached.
    return 0, 0, 0`,
        hints: [
          R`Keep the loss from before each step. After the step, compute the new loss and compare.`,
          R`Count the steps as you go, and <code>break</code> out of the loop when <code>old_loss - new_loss &lt; tol</code>.`,
          R`<pre><code>w, b, n = 0, 0, 0
old = loss(w, b, xs, ys)
while n &lt; max_steps:
    w, b = step(w, b, xs, ys, lr)
    n += 1
    new = loss(w, b, xs, ys)
    if old - new &lt; tol:
        break
    old = new
return w, b, n</code></pre>`,
        ],
        solution: R`def train_until(xs, ys, lr, tol, max_steps):
    # Step until the loss improves by less than tol, or max_steps is reached.
    w, b, n = 0, 0, 0
    old = loss(w, b, xs, ys)
    while n < max_steps:
        w, b = step(w, b, xs, ys, lr)
        n += 1
        new = loss(w, b, xs, ys)
        if old - new < tol:
            break
        old = new
    return w, b, n`,
        tests: [
          { name: 'it still finds the best line', check: R`w, b, n = train_until(xs, ys, 0.05, 1e-9, 100000); assert close(w, 1.5) and close(b, 0.333), f"got w = {w:.3f}, b = {b:.3f}"` },
          { name: 'it stops early', check: R`w, b, n = train_until(xs, ys, 0.05, 1e-9, 100000); assert 10 < n < 5000, f"took {n} steps; expected it to stop well before 100000"` },
          { name: 'a looser tol stops sooner', check: R`a = train_until(xs, ys, 0.05, 1e-3, 100000)[2]; b_ = train_until(xs, ys, 0.05, 1e-9, 100000)[2]; assert a < b_, f"tol 1e-3 took {a} steps, tol 1e-9 took {b_}"` },
          { name: 'max_steps is respected', check: R`r = train_until(xs, ys, 0.05, 0, 5); assert r[2] == 5, f"with max_steps = 5 it took {r[2]} steps"` },
        ],
      },
      {
        id: 'two-inputs',
        type: 'extend',
        title: 'Two inputs instead of one',
        given: BASE,
        brief: R`<p>Real predictions use more than one measurement. With two inputs the model becomes a flat plane:</p>
          \[ \hat{y} = w_1 x_1 + w_2 x_2 + b \]
          <p>The gradients follow the same pattern as before, one per number: \(\frac{\partial L}{\partial w_1} = -\frac{2}{n}\sum x_1 e\), \(\frac{\partial L}{\partial w_2} = -\frac{2}{n}\sum x_2 e\), \(\frac{\partial L}{\partial b} = -\frac{2}{n}\sum e\).</p>
          <p>Write <code>predict2(w1, w2, b, x1, x2)</code> and <code>train2(x1s, x2s, ys, lr, steps)</code>, which starts at all zeros and returns <code>(w1, w2, b)</code>.</p>`,
        starter: R`def predict2(w1, w2, b, x1, x2):
    return 0

def train2(x1s, x2s, ys, lr, steps):
    # Gradient descent on w1, w2 and b together. Return (w1, w2, b).
    return 0, 0, 0`,
        hints: [
          R`<code>predict2</code> is one line. In <code>train2</code>, compute the errors for every point first, then the three slopes, then update all three numbers.`,
          R`Errors: <code>errs = [y - predict2(w1, w2, b, a, c) for a, c, y in zip(x1s, x2s, ys)]</code>. You can reuse <code>gradient_w(x1s, errs)</code>, <code>gradient_w(x2s, errs)</code> and <code>gradient_b(errs)</code>.`,
          R`Inside the loop: <code>w1, w2, b = w1 - lr * gradient_w(x1s, errs), w2 - lr * gradient_w(x2s, errs), b - lr * gradient_b(errs)</code>.`,
        ],
        solution: R`def predict2(w1, w2, b, x1, x2):
    return w1 * x1 + w2 * x2 + b

def train2(x1s, x2s, ys, lr, steps):
    # Gradient descent on w1, w2 and b together. Return (w1, w2, b).
    w1, w2, b = 0, 0, 0
    for _ in range(steps):
        errs = [y - predict2(w1, w2, b, a, c) for a, c, y in zip(x1s, x2s, ys)]
        w1, w2, b = w1 - lr * gradient_w(x1s, errs), w2 - lr * gradient_w(x2s, errs), b - lr * gradient_b(errs)
    return w1, w2, b`,
        tests: [
          { name: 'predict2(2, -1, 1, 3, 4) is 3', check: R`r = predict2(2, -1, 1, 3, 4); assert close(r, 3), f"got {r}; 2 × 3 − 1 × 4 + 1 = 3"` },
          { name: 'learns y = 2·x1 − x2 + 1', check: R`x1s = [0, 1, 2, 3, 1, 2, 0, 3]; x2s = [1, 0, 2, 1, 3, 3, 2, 0]; ys2 = [2 * a - c + 1 for a, c in zip(x1s, x2s)]
w1, w2, b = train2(x1s, x2s, ys2, 0.05, 3000)
assert close(w1, 2, 0.02) and close(w2, -1, 0.02) and close(b, 1, 0.02), f"got w1 = {w1:.3f}, w2 = {w2:.3f}, b = {b:.3f}"` },
          { name: 'zero steps leaves all three at 0', check: R`assert tuple(train2([1], [1], [1], 0.1, 0)) == (0, 0, 0)` },
        ],
      },
      {
        id: 'best-rate',
        type: 'design',
        title: 'Choose the learning rate',
        given: BASE,
        brief: R`<p>Too small a learning rate crawls; too large a one overshoots and blows up. Rather than guess, try several.</p>
          <p>Write <code>best_lr(xs, ys, rates, steps)</code>. Train once with each rate for <code>steps</code> steps and return the rate with the lowest final loss. Skip any rate that diverged: its final loss is not a finite number, or is higher than the loss at the start. If every rate diverged, return <code>None</code>.</p>
          <p>How you structure it is up to you.</p>`,
        starter: R`import math

def best_lr(xs, ys, rates, steps):
    # Return the rate with the lowest final loss, ignoring rates that diverged (or None).
    return None`,
        hints: [
          R`For each rate: <code>w, b = train(xs, ys, rate, steps)</code>, then <code>loss(w, b, xs, ys)</code>.`,
          R`<code>math.isfinite(x)</code> is False for infinity and for NaN. The loss at the start is <code>loss(0, 0, xs, ys)</code>.`,
          R`Keep the best (loss, rate) pair seen so far; start with <code>best = None</code>, and only replace it when the loss is finite, below the starting loss, and lower than the best so far.`,
        ],
        solution: R`import math

def best_lr(xs, ys, rates, steps):
    # Return the rate with the lowest final loss, ignoring rates that diverged (or None).
    start = loss(0, 0, xs, ys)
    best, best_loss = None, None
    for rate in rates:
        w, b = train(xs, ys, rate, steps)
        L = loss(w, b, xs, ys)
        if not math.isfinite(L) or L > start:
            continue
        if best_loss is None or L < best_loss:
            best, best_loss = rate, L
    return best`,
        tests: [
          { name: 'picks 0.1 from 0.001, 0.01, 0.1 and 0.5', check: R`r = best_lr(xs, ys, [0.001, 0.01, 0.1, 0.5], 200); assert r == 0.1, f"got {r}"` },
          { name: 'order does not matter', check: R`r = best_lr(xs, ys, [0.5, 0.1, 0.01], 200); assert r == 0.1, f"got {r}"` },
          { name: 'returns None when every rate diverges', check: R`r = best_lr(xs, ys, [0.5, 1.0], 200); assert r is None, f"got {r}; both of these rates blow up"` },
        ],
      },
    ],
  };
})();
