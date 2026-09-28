// Coding lab for the Random Forests and Gradient Boosting lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  const NOTE = String.raw`<p class="ide-note">The first run downloads scikit-learn into your browser (about 40 MB, once). It can take up to a minute; later runs are instant.</p>`;
  const GIVEN = R`import random

# ── Given: the decision tree from Lesson 6 ──────────────────────────────
# One addition: pass an rng, and each question looks at ONE random measurement.
def gini(labels):
    if not labels:
        return 0
    p = sum(labels) / len(labels)
    return 1 - p ** 2 - (1 - p) ** 2

def build_tree(X, ys, depth, max_depth, rng=None):
    leaf = {"leaf": True, "label": 1 if sum(ys) * 2 >= len(ys) else 0}
    if gini(ys) == 0 or depth == max_depth:
        return leaf
    features = [rng.randrange(len(X[0]))] if rng else range(len(X[0]))
    best = None
    for f in features:
        values = sorted(set(x[f] for x in X))
        for a, b in zip(values, values[1:]):
            t = (a + b) / 2
            ly = [y for x, y in zip(X, ys) if x[f] <= t]
            ry = [y for x, y in zip(X, ys) if x[f] > t]
            mess = (len(ly) * gini(ly) + len(ry) * gini(ry)) / len(ys)
            if best is None or mess < best[2]:
                best = (f, t, mess)
    if best is None or best[2] >= gini(ys):
        return leaf
    f, t, _ = best
    left = [(x, y) for x, y in zip(X, ys) if x[f] <= t]
    right = [(x, y) for x, y in zip(X, ys) if x[f] > t]
    return {"leaf": False, "f": f, "t": t,
            "left": build_tree([x for x, _ in left], [y for _, y in left], depth + 1, max_depth, rng),
            "right": build_tree([x for x, _ in right], [y for _, y in right], depth + 1, max_depth, rng)}

def predict_tree(node, x):
    while not node["leaf"]:
        node = node["left"] if x[node["f"]] <= node["t"] else node["right"]
    return node["label"]

# ── Given: a round region with 10% noisy labels ─────────────────────────
def make_points(n, rng):
    X, ys = [], []
    for _ in range(n):
        a, b = rng.uniform(-3, 3), rng.uniform(-3, 3)
        y = 1 if a * a + b * b < 4.5 else 0
        if rng.random() < 0.1:
            y = 1 - y
        X.append((a, b))
        ys.append(y)
    return X, ys

data_rng = random.Random(7)
train_X, train_y = make_points(120, data_rng)
test_X, test_y = make_points(400, data_rng)
`;
  window.LABS = window.LABS || {};
  window.LABS['random-forests'] = {
    file: 'ensembles.py',
    title: 'Grow a forest, then boost it',
    intro: R`Thirteen small steps. The decision tree from Lesson 6 is given, so you can focus on the new ideas: bootstrap samples, voting forests, and boosting with tiny one-question trees. The last step checks your work against scikit-learn.`,
    doneTitle: 'You built a random forest and gradient boosting from scratch.',
    doneText: 'Every line below is yours, on top of the Lesson 6 tree: bootstrap sampling, a voting forest, stumps, and a boosting loop that learns from its own mistakes. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your forest and your booster work.',
    steps: [
      {
        id: 'baseline', title: 'One deep tree',
        brief: R`<p>The code above the line is given: Lesson 6's tree and a noisy round dataset, 120 points to train on and 400 new ones to test on.</p>
          <p>Write <code>accuracy(predict, X, ys)</code>, where <code>predict</code> is any function that labels one point. Then grow one deep tree (<code>max_depth=20</code>) and measure it on both sets. Expect a perfect score on the training points and a much worse one on the new points.</p>`,
        starter: GIVEN + R`
# ── Your code ────────────────────────────────────────────────────────────
def accuracy(predict, X, ys):
    # share of points where predict(x) == y
    return 0

tree = build_tree(train_X, train_y, 0, 20)
train_acc = accuracy(lambda x: predict_tree(tree, x), train_X, train_y)
test_acc = accuracy(lambda x: predict_tree(tree, x), test_X, test_y)
print(f"one deep tree: training {train_acc:.0%}, new points {test_acc:.0%}")`,
        hint: R`<code>return sum(predict(x) == y for x, y in zip(X, ys)) / len(ys)</code>`,
        solution: GIVEN + R`
# ── Your code ────────────────────────────────────────────────────────────
def accuracy(predict, X, ys):
    # share of points where predict(x) == y
    return sum(predict(x) == y for x, y in zip(X, ys)) / len(ys)

tree = build_tree(train_X, train_y, 0, 20)
train_acc = accuracy(lambda x: predict_tree(tree, x), train_X, train_y)
test_acc = accuracy(lambda x: predict_tree(tree, x), test_X, test_y)
print(f"one deep tree: training {train_acc:.0%}, new points {test_acc:.0%}")`,
        tests: [
          { name: 'accuracy counts the share of hits', check: R`r = accuracy(lambda x: x, [0, 1, 1, 0], [0, 1, 0, 0]); assert close(r, 0.75, 1e-9), f"got {r}"` },
          { name: 'the deep tree is perfect on its training points', check: R`assert close(train_acc, 1.0, 1e-9), f"training accuracy {train_acc}"` },
          { name: 'but much worse on new points', check: R`assert close(test_acc, 0.745, 1e-6), f"new-point accuracy {test_acc}, expected 0.745"` },
        ],
      },
      {
        id: 'bootstrap', title: 'Pick with replacement',
        brief: R`<p>A <strong>bootstrap sample</strong> draws \(n\) positions out of \(n\), putting each one back before the next draw, so some positions repeat and others are missed.</p>
          <p>Write <code>bootstrap(n, rng)</code> returning a list of \(n\) positions, each from <code>rng.randrange(n)</code>. Using the given <code>rng</code> (a <code>random.Random</code>) makes the result repeatable.</p>`,
        starter: R`def bootstrap(n, rng):
    # n positions, each drawn from 0 .. n-1 with replacement
    return []`,
        hint: R`<code>return [rng.randrange(n) for _ in range(n)]</code>`,
        solution: R`def bootstrap(n, rng):
    # n positions, each drawn from 0 .. n-1 with replacement
    return [rng.randrange(n) for _ in range(n)]`,
        tests: [
          { name: 'n positions, all in range', check: R`r = bootstrap(50, random.Random(1)); assert len(r) == 50 and all(0 <= i < 50 for i in r), f"got {len(r)} positions"` },
          { name: 'the same seed gives the same sample', check: R`assert bootstrap(20, random.Random(5)) == bootstrap(20, random.Random(5)), "use rng.randrange so results repeat"` },
          { name: 'some positions repeat', check: R`r = bootstrap(120, random.Random(100)); assert len(set(r)) == 81, f"{len(set(r))} different positions, expected 81"` },
        ],
      },
      {
        id: 'oob', title: 'Who was left out?',
        brief: R`<p>The positions never drawn are called <strong>out of bag</strong>. For large \(n\) about 37% of points are left out, because</p>
          \[ \left(1 - \tfrac{1}{n}\right)^n \approx 0.37 \]
          <p>Write <code>out_of_bag(n, idx)</code> returning the positions from 0 to \(n-1\) that are not in <code>idx</code>, in increasing order.</p>`,
        starter: R`def out_of_bag(n, idx):
    # positions 0 .. n-1 that were never drawn
    return []

left_out = out_of_bag(120, bootstrap(120, random.Random(100)))
print(len(left_out), "of 120 left out", f"({len(left_out) / 120:.0%})")`,
        hint: R`<code>picked = set(idx)</code>, then <code>return [i for i in range(n) if i not in picked]</code>.`,
        solution: R`def out_of_bag(n, idx):
    # positions 0 .. n-1 that were never drawn
    picked = set(idx)
    return [i for i in range(n) if i not in picked]

left_out = out_of_bag(120, bootstrap(120, random.Random(100)))
print(len(left_out), "of 120 left out", f"({len(left_out) / 120:.0%})")`,
        tests: [
          { name: 'a small example', check: R`r = out_of_bag(5, [0, 0, 2, 4, 4]); assert list(r) == [1, 3], f"got {r}"` },
          { name: '39 of 120 left out', check: R`assert len(left_out) == 39, f"got {len(left_out)}"` },
        ],
      },
      {
        id: 'take', title: 'Build the sample',
        brief: R`<p>Turn a list of positions into an actual training set. Write <code>take(X, ys, idx)</code> returning <code>(sample_X, sample_y)</code>, repeating points exactly as often as their position appears in <code>idx</code>.</p>`,
        starter: R`def take(X, ys, idx):
    # the points and labels at these positions, repeats included
    return [], []`,
        hint: R`<code>return [X[i] for i in idx], [ys[i] for i in idx]</code>`,
        solution: R`def take(X, ys, idx):
    # the points and labels at these positions, repeats included
    return [X[i] for i in idx], [ys[i] for i in idx]`,
        tests: [
          { name: 'repeats are kept', check: R`sx, sy = take(["a", "b", "c"], [0, 1, 0], [1, 1, 2]); assert sx == ["b", "b", "c"] and sy == [1, 1, 0], f"got {sx}, {sy}"` },
        ],
      },
      {
        id: 'train_forest', title: 'Grow the forest',
        brief: R`<p>Each tree gets its own bootstrap sample, and its own random choice of measurement at every question. Tree number \(i\) uses <code>random.Random(seed + i)</code> for both, so the forest is repeatable.</p>
          <p>Write <code>train_forest(X, ys, n_trees, max_depth, seed)</code> returning a list of trees. Pass the tree's <code>rng</code> to <code>build_tree</code> as its last argument.</p>`,
        starter: R`def train_forest(X, ys, n_trees, max_depth, seed):
    # one tree per bootstrap sample, each with its own rng
    forest = []

    return forest`,
        hint: R`Loop <code>for i in range(n_trees):</code> with <code>rng = random.Random(seed + i)</code>, <code>sx, sy = take(X, ys, bootstrap(len(X), rng))</code>, and append <code>build_tree(sx, sy, 0, max_depth, rng)</code>.`,
        solution: R`def train_forest(X, ys, n_trees, max_depth, seed):
    # one tree per bootstrap sample, each with its own rng
    forest = []
    for i in range(n_trees):
        rng = random.Random(seed + i)
        sx, sy = take(X, ys, bootstrap(len(X), rng))
        forest.append(build_tree(sx, sy, 0, max_depth, rng))
    return forest`,
        tests: [
          { name: 'one tree per member', check: R`f = train_forest(train_X, train_y, 5, 20, 100); assert len(f) == 5 and all(isinstance(t, dict) for t in f), f"got {len(f)} trees"` },
          { name: 'the trees differ', check: R`f = train_forest(train_X, train_y, 3, 20, 100); assert f[0] != f[1] and f[1] != f[2], "each tree should see a different sample"` },
          { name: 'repeatable with the same seed', check: R`assert train_forest(train_X, train_y, 2, 20, 100) == train_forest(train_X, train_y, 2, 20, 100), "use random.Random(seed + i)"` },
        ],
      },
      {
        id: 'votes', title: 'Ask every tree',
        brief: R`<p>Write <code>votes(forest, x)</code> returning each tree's answer (0 or 1) for the point <code>x</code>, in order.</p>`,
        starter: R`def votes(forest, x):
    # one answer per tree
    return []`,
        hint: R`<code>return [predict_tree(t, x) for t in forest]</code>`,
        solution: R`def votes(forest, x):
    # one answer per tree
    return [predict_tree(t, x) for t in forest]`,
        tests: [
          { name: 'one vote per tree', check: R`f = train_forest(train_X, train_y, 7, 20, 100); r = votes(f, (0, 0)); assert len(r) == 7 and set(r) <= {0, 1}, f"got {r}"` },
          { name: 'the centre of the circle is mostly 1', check: R`f = train_forest(train_X, train_y, 15, 20, 100); r = votes(f, (0.2, 0.3)); assert sum(r) > len(r) / 2, f"got {r}"` },
        ],
      },
      {
        id: 'forest_predict', title: 'The majority wins',
        brief: R`<p>The forest answers with the majority vote: 1 when at least half the trees say 1. Write <code>forest_predict(forest, x)</code>.</p>`,
        starter: R`def forest_predict(forest, x):
    # 1 if at least half the trees vote 1
    return 0`,
        hint: R`<code>v = votes(forest, x)</code>, then <code>return 1 if sum(v) * 2 >= len(v) else 0</code>.`,
        solution: R`def forest_predict(forest, x):
    # 1 if at least half the trees vote 1
    v = votes(forest, x)
    return 1 if sum(v) * 2 >= len(v) else 0`,
        tests: [
          { name: 'inside the circle is 1', check: R`f = train_forest(train_X, train_y, 15, 20, 100); assert forest_predict(f, (0.2, 0.3)) == 1, "expected 1"` },
          { name: 'far outside is 0', check: R`f = train_forest(train_X, train_y, 15, 20, 100); assert forest_predict(f, (2.8, -2.8)) == 0, "expected 0"` },
        ],
      },
      {
        id: 'compare', title: 'Forest versus one tree',
        brief: R`<p>Grow 25 trees with <code>max_depth=20</code> and seed 100, and measure the forest on the 400 new points. It should clearly beat the single deep tree from step 1.</p>`,
        starter: R`forest = []          # replace: train_forest(...)
forest_acc = 0       # replace: accuracy of forest_predict on the test points

print(f"one deep tree: {test_acc:.1%}   forest of 25: {forest_acc:.1%}")`,
        hint: R`<code>forest = train_forest(train_X, train_y, 25, 20, 100)</code> and <code>forest_acc = accuracy(lambda x: forest_predict(forest, x), test_X, test_y)</code>.`,
        solution: R`forest = train_forest(train_X, train_y, 25, 20, 100)
forest_acc = accuracy(lambda x: forest_predict(forest, x), test_X, test_y)

print(f"one deep tree: {test_acc:.1%}   forest of 25: {forest_acc:.1%}")`,
        tests: [
          { name: 'the forest has 25 trees', check: R`assert len(forest) == 25, f"got {len(forest)}"` },
          { name: 'the forest beats one deep tree', check: R`assert forest_acc > test_acc + 0.03, f"forest {forest_acc:.3f}, single tree {test_acc:.3f}"` },
        ],
      },
      {
        id: 'stump', title: 'A one-question tree',
        brief: R`<p>Now boosting, on numbers instead of classes. Its building block is a <strong>stump</strong>: one question "is \(x \le t\)?", answering with the average on each side.</p>
          <p>Write <code>fit_stump(xs, rs)</code> returning <code>(t, left_mean, right_mean)</code>. Try each midpoint between neighbouring distinct <code>xs</code>, and keep the one with the smallest total squared error around the two means. On ties, keep the first.</p>`,
        starter: R`def fit_stump(xs, rs):
    # best (t, left_mean, right_mean) by squared error
    best = None
    values = sorted(set(xs))
    for a, b in zip(values, values[1:]):
        t = (a + b) / 2
        # split rs by x <= t, take each side's mean and squared error

    return best`,
        hint: R`Inside the loop: <code>left = [r for x, r in zip(xs, rs) if x &lt;= t]</code>, <code>right</code> likewise, <code>ml = sum(left) / len(left)</code>, <code>mr</code> likewise, <code>sse = sum((r - ml) ** 2 for r in left) + sum((r - mr) ** 2 for r in right)</code>. Keep a 4th entry for the error, then <code>return best[:3]</code>.`,
        solution: R`def fit_stump(xs, rs):
    # best (t, left_mean, right_mean) by squared error
    best = None
    values = sorted(set(xs))
    for a, b in zip(values, values[1:]):
        t = (a + b) / 2
        left = [r for x, r in zip(xs, rs) if x <= t]
        right = [r for x, r in zip(xs, rs) if x > t]
        ml, mr = sum(left) / len(left), sum(right) / len(right)
        sse = sum((r - ml) ** 2 for r in left) + sum((r - mr) ** 2 for r in right)
        if best is None or sse < best[3]:
            best = (t, ml, mr, sse)
    return best[:3]`,
        tests: [
          { name: 'the worked example: x ≤ 3.5 ? −1 : 3', check: R`r = fit_stump([1, 2, 3, 4], [-2, 0, -1, 3]); assert close(r[0], 3.5, 1e-9) and close(r[1], -1, 1e-9) and close(r[2], 3, 1e-9), f"got {r}"` },
          { name: 'a clean step is found exactly', check: R`r = fit_stump([1, 2, 3, 4], [5, 5, 9, 9]); assert close(r[0], 2.5, 1e-9) and close(r[1], 5, 1e-9) and close(r[2], 9, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'boost', title: 'Learn from the mistakes',
        brief: R`<p>Boosting starts from the average, then repeats: measure the residuals \(r = y - F(x)\), fit a stump to them, and add a small part of it:</p>
          \[ F(x) \leftarrow F(x) + \eta \times \text{stump}(x) \]
          <p>Write <code>boost(xs, ys, rounds, lr)</code> returning <code>(base, stumps)</code>, where <code>base</code> is the average of <code>ys</code>. A stump's answer for <code>x</code> is <code>ml if x &lt;= t else mr</code>.</p>`,
        starter: R`def boost(xs, ys, rounds, lr):
    # start at the average, then add lr * a stump fitted to the residuals
    base = sum(ys) / len(ys)
    F = [base] * len(xs)
    stumps = []

    return base, stumps`,
        hint: R`Each round: <code>rs = [y - f for y, f in zip(ys, F)]</code>, <code>t, ml, mr = fit_stump(xs, rs)</code>, append it, then <code>F = [f + lr * (ml if x &lt;= t else mr) for x, f in zip(xs, F)]</code>.`,
        solution: R`def boost(xs, ys, rounds, lr):
    # start at the average, then add lr * a stump fitted to the residuals
    base = sum(ys) / len(ys)
    F = [base] * len(xs)
    stumps = []
    for _ in range(rounds):
        rs = [y - f for y, f in zip(ys, F)]
        t, ml, mr = fit_stump(xs, rs)
        stumps.append((t, ml, mr))
        F = [f + lr * (ml if x <= t else mr) for x, f in zip(xs, F)]
    return base, stumps`,
        tests: [
          { name: 'starts from the average', check: R`b, s = boost([1, 2, 3, 4], [1, 3, 2, 6], 0, 0.5); assert close(b, 3, 1e-9) and s == [], f"got base {b}, {len(s)} stumps"` },
          { name: 'round 1 fits the worked example', check: R`b, s = boost([1, 2, 3, 4], [1, 3, 2, 6], 1, 0.5); assert len(s) == 1 and close(s[0][0], 3.5, 1e-9) and close(s[0][1], -1, 1e-9) and close(s[0][2], 3, 1e-9), f"got {s}"` },
          { name: 'round 2 fits what round 1 missed', check: R`b, s = boost([1, 2, 3, 4], [1, 3, 2, 6], 2, 0.5); assert len(s) == 2 and close(s[1][0], 1.5, 1e-9), f"second stump {s[1] if len(s) > 1 else None}"` },
        ],
      },
      {
        id: 'boost_predict', title: 'Add it all up',
        brief: R`<p>A boosted model's prediction is the base plus every stump's small contribution:</p>
          \[ F(x) = \text{base} + \eta \times \text{stump}_1(x) + \eta \times \text{stump}_2(x) + \dots \]
          <p>Write <code>boost_predict(model, x, lr)</code> for <code>model = (base, stumps)</code>.</p>`,
        starter: R`def boost_predict(model, x, lr):
    # base + lr * each stump's answer
    base, stumps = model
    return base`,
        hint: R`<code>return base + sum(lr * (ml if x &lt;= t else mr) for t, ml, mr in stumps)</code>`,
        solution: R`def boost_predict(model, x, lr):
    # base + lr * each stump's answer
    base, stumps = model
    return base + sum(lr * (ml if x <= t else mr) for t, ml, mr in stumps)`,
        tests: [
          { name: 'after one round: 2.5, 2.5, 2.5, 4.5', check: R`m = boost([1, 2, 3, 4], [1, 3, 2, 6], 1, 0.5); r = [boost_predict(m, x, 0.5) for x in [1, 2, 3, 4]]; assert all(close(a, b, 1e-9) for a, b in zip(r, [2.5, 2.5, 2.5, 4.5])), f"got {r}"` },
          { name: 'the squared error falls from 3.5 to 1.25', check: R`m = boost([1, 2, 3, 4], [1, 3, 2, 6], 1, 0.5); e = sum((boost_predict(m, x, 0.5) - y) ** 2 for x, y in zip([1, 2, 3, 4], [1, 3, 2, 6])) / 4; assert close(e, 1.25, 1e-9), f"got {e}"` },
        ],
      },
      {
        id: 'use', title: 'Put it to work',
        brief: R`<p>Boost on a noisy wave (generated for you) with a learning rate of 0.3, and watch the squared error fall as trees are added. Set <code>model</code> to 100 rounds, and fill in <code>mse</code> to measure any model on the wave.</p>`,
        starter: R`import math
wave_rng = random.Random(3)
wave_x = sorted(wave_rng.uniform(-3, 3) for _ in range(40))
wave_y = [math.sin(1.3 * x) + 0.3 * x + wave_rng.gauss(0, 0.25) for x in wave_x]

def mse(model, lr):
    # average squared error of boost_predict on the wave
    return 0

model = None     # replace: boost the wave for 100 rounds with lr = 0.3

for rounds in (1, 5, 20, 100):
    print(f"{rounds:>3} trees: squared error {mse(boost(wave_x, wave_y, rounds, 0.3), 0.3):.3f}")`,
        hint: R`<code>return sum((boost_predict(model, x, lr) - y) ** 2 for x, y in zip(wave_x, wave_y)) / len(wave_x)</code>, and <code>model = boost(wave_x, wave_y, 100, 0.3)</code>.`,
        solution: R`import math
wave_rng = random.Random(3)
wave_x = sorted(wave_rng.uniform(-3, 3) for _ in range(40))
wave_y = [math.sin(1.3 * x) + 0.3 * x + wave_rng.gauss(0, 0.25) for x in wave_x]

def mse(model, lr):
    # average squared error of boost_predict on the wave
    return sum((boost_predict(model, x, lr) - y) ** 2 for x, y in zip(wave_x, wave_y)) / len(wave_x)

model = boost(wave_x, wave_y, 100, 0.3)

for rounds in (1, 5, 20, 100):
    print(f"{rounds:>3} trees: squared error {mse(boost(wave_x, wave_y, rounds, 0.3), 0.3):.3f}")`,
        tests: [
          { name: 'model has 100 stumps', check: R`assert model is not None and len(model[1]) == 100, "boost for 100 rounds"` },
          { name: 'more trees, smaller error', check: R`e = [mse(boost(wave_x, wave_y, r, 0.3), 0.3) for r in (1, 5, 20, 100)]; assert all(a > b for a, b in zip(e, e[1:])), f"errors {e}"` },
          { name: '100 trees fit the wave closely', check: R`assert close(mse(model, 0.3), 0.0472, 0.002), f"got {mse(model, 0.3):.4f}"` },
        ],
      },
      {
        id: 'sklearn', title: 'Check with scikit-learn',
        brief: R`<p>scikit-learn has both ideas ready-made. Its <code>GradientBoostingRegressor</code> with <code>max_depth=1</code> grows the same stumps as yours, so its predictions should match. Its <code>RandomForestClassifier</code> uses different random choices, so compare only the accuracy.</p>
          <p>Fill in the two models and the two results.</p>${NOTE}`,
        starter: R`import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor

sk_forest = None   # replace: RandomForestClassifier(n_estimators=25, random_state=0).fit(train_X, train_y)
sk_acc = None      # replace: sk_forest.score(test_X, test_y)
sk_boost = None    # replace: GradientBoostingRegressor(n_estimators=100, learning_rate=0.3, max_depth=1, criterion="squared_error").fit(...)

print(f"forest accuracy: mine {forest_acc:.1%}  scikit-learn {sk_acc}")
if sk_boost is not None:
    x = 1.0
    print(f"boosted prediction at x = 1: mine {boost_predict(model, x, 0.3):.4f}  scikit-learn {sk_boost.predict([[x]])[0]:.4f}")`,
        hint: R`The regressor wants a column of inputs: <code>.fit(np.array(wave_x).reshape(-1, 1), wave_y)</code>.`,
        solution: R`import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor

sk_forest = RandomForestClassifier(n_estimators=25, random_state=0).fit(train_X, train_y)
sk_acc = sk_forest.score(test_X, test_y)
sk_boost = GradientBoostingRegressor(n_estimators=100, learning_rate=0.3, max_depth=1, criterion="squared_error").fit(np.array(wave_x).reshape(-1, 1), wave_y)

print(f"forest accuracy: mine {forest_acc:.1%}  scikit-learn {sk_acc:.1%}")
if sk_boost is not None:
    x = 1.0
    print(f"boosted prediction at x = 1: mine {boost_predict(model, x, 0.3):.4f}  scikit-learn {sk_boost.predict([[x]])[0]:.4f}")`,
        tests: [
          { name: 'scikit-learn forest also beats one deep tree', check: R`assert sk_acc is not None and sk_acc > test_acc, f"scikit-learn {sk_acc}, single tree {test_acc}"` },
          { name: 'same boosted predictions as yours', check: R`import numpy as _np; xs_ = [-2.5, -1.0, 0.0, 1.0, 2.5]; p = sk_boost.predict(_np.array(xs_).reshape(-1, 1)); assert all(close(a, boost_predict(model, x, 0.3), 1e-6) for a, x in zip(p, xs_)), f"scikit-learn {list(p)}"` },
        ],
      },
    ],
  };
})();
