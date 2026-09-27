// Coding lab for the Decision Trees lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  const NOTE = String.raw`<p class="ide-note">The first run downloads scikit-learn into your browser (about 40 MB, once). It can take up to a minute; later runs are instant.</p>`;
  window.LABS = window.LABS || {};
  window.LABS['decision-trees'] = {
    file: 'decision_tree.py',
    title: 'Write a decision tree from scratch',
    intro: R`Thirteen small steps: measure mess with Gini impurity, split the data, search for the best question, grow the tree recursively, and choose a depth that does not memorise the noise. Plain Python, no libraries. The last step checks your work against scikit-learn, the library used in practice.`,
    doneTitle: 'You wrote a decision tree from scratch.',
    doneText: 'Every line below is yours: Gini impurity, splitting, the search for the best question, recursive growing, prediction and choosing a depth. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your decision tree works.',
    steps: [
      {
        id: 'data', title: 'Store the points',
        brief: R`<p>Ten points from the worked example, each with two measurements and a label of 0 or 1. Store them in <code>X</code> and <code>ys</code>.</p>`,
        starter: R`X = [(2, 7), (3, 6), (4, 8), (5, 3), (6, 2), (7, 4), (6, 7), (8, 6), (3, 2), (7, 8)]
ys = []   # labels: 0, 0, 0, 1, 1, 1, 0, 1, 0, 1`,
        hint: R`<code>ys = [0, 0, 0, 1, 1, 1, 0, 1, 0, 1]</code>`,
        solution: R`X = [(2, 7), (3, 6), (4, 8), (5, 3), (6, 2), (7, 4), (6, 7), (8, 6), (3, 2), (7, 8)]
ys = [0, 0, 0, 1, 1, 1, 0, 1, 0, 1]`,
        tests: [
          { name: 'ten labels in order', check: R`assert list(ys) == [0, 0, 0, 1, 1, 1, 0, 1, 0, 1], f"ys is {ys!r}"` },
        ],
      },
      {
        id: 'gini', title: 'Measure the mess',
        brief: R`<p>For labels 0 and 1, with \(p\) the share of 1s in the group:</p>
          \[ \text{Gini} = 1 - p^2 - (1 - p)^2 \]
          <p>Write <code>gini(labels)</code>. An empty group has no mess: return 0.</p>`,
        starter: R`def gini(labels):
    # 1 - p^2 - (1 - p)^2, where p is the share of 1s
    return 0`,
        hint: R`If the list is empty return 0. Otherwise <code>p = sum(labels) / len(labels)</code> and <code>return 1 - p ** 2 - (1 - p) ** 2</code>.`,
        solution: R`def gini(labels):
    # 1 - p^2 - (1 - p)^2, where p is the share of 1s
    if not labels:
        return 0
    p = sum(labels) / len(labels)
    return 1 - p ** 2 - (1 - p) ** 2`,
        tests: [
          { name: 'a pure group has no mess', check: R`assert gini([1, 1, 1]) == 0 and gini([0, 0]) == 0, f"got {gini([1, 1, 1])}, {gini([0, 0])}"` },
          { name: 'half and half gives 0.5', check: R`r = gini([0, 1, 0, 1]); assert close(r, 0.5, 1e-9), f"got {r}"` },
          { name: 'the ten points give 0.5', check: R`r = gini(ys); assert close(r, 0.5, 1e-9), f"got {r}"` },
          { name: 'an empty group is 0', check: R`assert gini([]) == 0, "empty list should give 0"` },
        ],
      },
      {
        id: 'split', title: 'Ask one question',
        brief: R`<p>The question "is measurement \(f\) greater than \(t\)?" splits the points in two. Points with value <strong>≤ t</strong> go left (no), the rest go right (yes).</p>
          <p>Write <code>split(X, ys, f, t)</code> returning <code>(left_X, left_y, right_X, right_y)</code>. Here <code>f</code> is 0 for the first measurement and 1 for the second.</p>`,
        starter: R`def split(X, ys, f, t):
    # left: x[f] <= t, right: x[f] > t
    left_X, left_y, right_X, right_y = [], [], [], []

    return left_X, left_y, right_X, right_y`,
        hint: R`Loop <code>for x, y in zip(X, ys):</code> and append to the left lists when <code>x[f] &lt;= t</code>, else to the right lists.`,
        solution: R`def split(X, ys, f, t):
    # left: x[f] <= t, right: x[f] > t
    left_X, left_y, right_X, right_y = [], [], [], []
    for x, y in zip(X, ys):
        if x[f] <= t:
            left_X.append(x)
            left_y.append(y)
        else:
            right_X.append(x)
            right_y.append(y)
    return left_X, left_y, right_X, right_y`,
        tests: [
          { name: 'x₁ > 4.5 puts four points on the left', check: R`lx, ly, rx, ry = split(X, ys, 0, 4.5); assert len(lx) == 4 and ly == [0, 0, 0, 0], f"left labels {ly}"` },
          { name: 'and six on the right', check: R`lx, ly, rx, ry = split(X, ys, 0, 4.5); assert ry == [1, 1, 1, 0, 1, 1], f"right labels {ry}"` },
          { name: 'works on the second measurement', check: R`lx, ly, rx, ry = split(X, ys, 1, 5); assert len(lx) == 4 and len(rx) == 6, f"{len(lx)} left, {len(rx)} right"` },
        ],
      },
      {
        id: 'weighted', title: 'Score a split',
        brief: R`<p>A split is good when both sides are tidy. Weight each side's Gini by its size:</p>
          \[ \text{mess} = \frac{n_{\text{left}}}{n} \times \text{Gini(left)} + \frac{n_{\text{right}}}{n} \times \text{Gini(right)} \]
          <p>Write <code>split_mess(left_y, right_y)</code>.</p>`,
        starter: R`def split_mess(left_y, right_y):
    # size-weighted Gini of the two sides
    return 0`,
        hint: R`<code>n = len(left_y) + len(right_y)</code>, then <code>return len(left_y) / n * gini(left_y) + len(right_y) / n * gini(right_y)</code>.`,
        solution: R`def split_mess(left_y, right_y):
    # size-weighted Gini of the two sides
    n = len(left_y) + len(right_y)
    return len(left_y) / n * gini(left_y) + len(right_y) / n * gini(right_y)`,
        tests: [
          { name: 'x₁ > 4.5 leaves mess 0.167', check: R`_, ly, _, ry = split(X, ys, 0, 4.5); r = split_mess(ly, ry); assert close(r, 1 / 6, 1e-6), f"got {r}, expected 6/10 × 0.278 = 0.167"` },
          { name: 'a perfect split has no mess', check: R`r = split_mess([0, 0], [1, 1, 1]); assert r == 0, f"got {r}"` },
        ],
      },
      {
        id: 'thresholds', title: 'Which cuts to try?',
        brief: R`<p>Only cuts between two neighbouring values can change anything, so try the midpoints. Sort the distinct values of measurement \(f\) and return the halfway point between each neighbouring pair.</p>
          <p>Write <code>thresholds(X, f)</code>.</p>`,
        starter: R`def thresholds(X, f):
    # midpoints between neighbouring distinct values of x[f]
    return []`,
        hint: R`<code>v = sorted(set(x[f] for x in X))</code>, then <code>return [(a + b) / 2 for a, b in zip(v, v[1:])]</code>.`,
        solution: R`def thresholds(X, f):
    # midpoints between neighbouring distinct values of x[f]
    v = sorted(set(x[f] for x in X))
    return [(a + b) / 2 for a, b in zip(v, v[1:])]`,
        tests: [
          { name: 'midpoints of the first measurement', check: R`r = thresholds(X, 0); assert r == [2.5, 3.5, 4.5, 5.5, 6.5, 7.5], f"got {r}"` },
          { name: 'repeated values are skipped', check: R`r = thresholds([(1, 0), (1, 0), (3, 0)], 0); assert r == [2.0], f"got {r}"` },
        ],
      },
      {
        id: 'best', title: 'Find the best question',
        brief: R`<p>Try every threshold on every measurement, and keep the one with the least mess. On ties keep the first one found (measurement 0 before 1, smaller thresholds first).</p>
          <p>Write <code>best_split(X, ys)</code> returning <code>(f, t, mess)</code>.</p>`,
        starter: R`def best_split(X, ys):
    # (feature, threshold, mess) with the smallest mess
    best = None
    for f in range(2):
        for t in thresholds(X, f):
            pass   # score this cut and keep it if it beats best
    return best`,
        hint: R`Inside the loops: <code>_, ly, _, ry = split(X, ys, f, t)</code>, <code>m = split_mess(ly, ry)</code>, and <code>if best is None or m &lt; best[2]: best = (f, t, m)</code>.`,
        solution: R`def best_split(X, ys):
    # (feature, threshold, mess) with the smallest mess
    best = None
    for f in range(2):
        for t in thresholds(X, f):
            _, ly, _, ry = split(X, ys, f, t)
            m = split_mess(ly, ry)
            if best is None or m < best[2]:
                best = (f, t, m)
    return best`,
        tests: [
          { name: 'the best first question is x₁ > 4.5', check: R`f, t, m = best_split(X, ys); assert f == 0 and close(t, 4.5, 1e-9), f"got feature {f}, threshold {t}"` },
          { name: 'its mess is 0.167', check: R`f, t, m = best_split(X, ys); assert close(m, 1 / 6, 1e-6), f"got {m}"` },
        ],
      },
      {
        id: 'majority', title: 'A leaf’s answer',
        brief: R`<p>A leaf predicts the most common label among its points. Write <code>majority(labels)</code> for labels 0 and 1. On a tie, answer 1.</p>`,
        starter: R`def majority(labels):
    # 1 if at least half the labels are 1, else 0
    return 0`,
        hint: R`<code>return 1 if sum(labels) * 2 >= len(labels) else 0</code>`,
        solution: R`def majority(labels):
    # 1 if at least half the labels are 1, else 0
    return 1 if sum(labels) * 2 >= len(labels) else 0`,
        tests: [
          { name: 'mostly 0 gives 0', check: R`assert majority([0, 0, 1]) == 0, f"got {majority([0, 0, 1])}"` },
          { name: 'mostly 1 gives 1', check: R`assert majority([1, 1, 0, 1]) == 1, f"got {majority([1, 1, 0, 1])}"` },
        ],
      },
      {
        id: 'build', title: 'Grow the tree',
        brief: R`<p>Build the tree recursively. A node is a dictionary:</p>
          <ul><li>a leaf: <code>{"leaf": True, "label": 0 or 1}</code></li>
          <li>a question: <code>{"leaf": False, "f": f, "t": t, "left": node, "right": node}</code></li></ul>
          <p>Make a leaf when the group is pure, when <code>depth == max_depth</code>, or when the best split doesn't reduce the mess. Otherwise split and build both sides with <code>depth + 1</code>.</p>`,
        starter: R`def build(X, ys, depth, max_depth):
    # return a leaf or a question node
    if gini(ys) == 0 or depth == max_depth:
        return {"leaf": True, "label": majority(ys)}

    return {"leaf": True, "label": majority(ys)}`,
        hint: R`Get <code>f, t, m = best_split(X, ys)</code>. If <code>m &gt;= gini(ys)</code> return a leaf. Otherwise <code>lx, ly, rx, ry = split(X, ys, f, t)</code> and return a question node whose <code>"left"</code> is <code>build(lx, ly, depth + 1, max_depth)</code> and whose <code>"right"</code> is built from the right side.`,
        solution: R`def build(X, ys, depth, max_depth):
    # return a leaf or a question node
    if gini(ys) == 0 or depth == max_depth:
        return {"leaf": True, "label": majority(ys)}
    f, t, m = best_split(X, ys)
    if m >= gini(ys):
        return {"leaf": True, "label": majority(ys)}
    lx, ly, rx, ry = split(X, ys, f, t)
    return {"leaf": False, "f": f, "t": t,
            "left": build(lx, ly, depth + 1, max_depth),
            "right": build(rx, ry, depth + 1, max_depth)}`,
        tests: [
          { name: 'depth 0 is a single leaf', check: R`r = build(X, ys, 0, 0); assert r["leaf"] is True, f"got {r}"` },
          { name: 'depth 1 asks x₁ > 4.5', check: R`r = build(X, ys, 0, 1); assert r["leaf"] is False and r["f"] == 0 and close(r["t"], 4.5, 1e-9), f"got {r}"` },
          { name: 'the left side is a pure leaf of 0s', check: R`r = build(X, ys, 0, 3); assert r["left"] == {"leaf": True, "label": 0}, f"got {r['left']}"` },
        ],
      },
      {
        id: 'predict', title: 'Follow the answers',
        brief: R`<p>To predict, start at the root and follow the answers until you reach a leaf. Write <code>predict(node, x)</code>. It can call itself on the left or right child.</p>`,
        starter: R`def predict(node, x):
    # follow the questions down to a leaf
    return 0`,
        hint: R`If <code>node["leaf"]</code>, return <code>node["label"]</code>. Otherwise go to <code>node["left"]</code> when <code>x[node["f"]] &lt;= node["t"]</code>, else <code>node["right"]</code>, and return <code>predict(child, x)</code>.`,
        solution: R`def predict(node, x):
    # follow the questions down to a leaf
    if node["leaf"]:
        return node["label"]
    child = node["left"] if x[node["f"]] <= node["t"] else node["right"]
    return predict(child, x)`,
        tests: [
          { name: 'depth 1: small x₁ is class 0', check: R`r = predict(build(X, ys, 0, 1), (2, 5)); assert r == 0, f"got {r}"` },
          { name: 'depth 1: large x₁ is class 1', check: R`r = predict(build(X, ys, 0, 1), (7, 3)); assert r == 1, f"got {r}"` },
          { name: 'a deep tree gets every training point right', check: R`tr = build(X, ys, 0, 5); assert [predict(tr, x) for x in X] == ys, "some training point is misclassified"` },
        ],
      },
      {
        id: 'accuracy', title: 'How often is it right?',
        brief: R`<p>Write <code>accuracy(tree, X, ys)</code>: the share of points the tree predicts correctly.</p>`,
        starter: R`def accuracy(tree, X, ys):
    # share of correct predictions
    return 0`,
        hint: R`<code>return sum(predict(tree, x) == y for x, y in zip(X, ys)) / len(ys)</code>`,
        solution: R`def accuracy(tree, X, ys):
    # share of correct predictions
    return sum(predict(tree, x) == y for x, y in zip(X, ys)) / len(ys)`,
        tests: [
          { name: 'depth 1 gets 9 of 10', check: R`r = accuracy(build(X, ys, 0, 1), X, ys); assert close(r, 0.9, 1e-9), f"got {r}"` },
          { name: 'a deep tree gets all 10', check: R`r = accuracy(build(X, ys, 0, 5), X, ys); assert close(r, 1.0, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'depth', title: 'How deep did it grow?',
        brief: R`<p>Write <code>depth_of(node)</code>: 0 for a leaf, otherwise 1 plus the deeper of its two children.</p>`,
        starter: R`def depth_of(node):
    # 0 for a leaf, else 1 + the deeper child
    return 0`,
        hint: R`<code>if node["leaf"]: return 0</code>, then <code>return 1 + max(depth_of(node["left"]), depth_of(node["right"]))</code>.`,
        solution: R`def depth_of(node):
    # 0 for a leaf, else 1 + the deeper child
    if node["leaf"]:
        return 0
    return 1 + max(depth_of(node["left"]), depth_of(node["right"]))`,
        tests: [
          { name: 'a limit of 1 gives depth 1', check: R`r = depth_of(build(X, ys, 0, 1)); assert r == 1, f"got {r}"` },
          { name: 'the tree stops once every leaf is pure', check: R`r = depth_of(build(X, ys, 0, 10)); assert r <= 4, f"got {r}"` },
        ],
      },
      {
        id: 'use', title: 'Put it to work',
        brief: R`<p>Now a bigger, noisy dataset (generated for you, the same every time). Build trees with <code>max_depth</code> from 1 to 8 and measure accuracy on the training points and on the separate test points.</p>
          <p>Set <code>best_depth</code> to the depth with the highest <strong>test</strong> accuracy (the smallest one on ties), and <code>tree</code> to a tree built with that depth.</p>`,
        starter: R`import random
random.seed(1)

def make(n):
    pts, labs = [], []
    for _ in range(n):
        a, b = random.uniform(0, 10), random.uniform(0, 10)
        label = 1 if (a > 4 and b > 3) else 0
        if random.random() < 0.1:
            label = 1 - label          # 10% noise
        pts.append((a, b))
        labs.append(label)
    return pts, labs

train_X, train_y = make(60)
test_X, test_y = make(300)

for d in range(1, 9):
    t = build(train_X, train_y, 0, d)
    print(f"depth {d}: train {accuracy(t, train_X, train_y):.0%}   test {accuracy(t, test_X, test_y):.0%}")

best_depth = 1      # replace: the depth with the best test accuracy
tree = None         # replace: build the tree with that depth
print("best depth:", best_depth)`,
        hint: R`<code>best_depth = max(range(1, 9), key=lambda d: accuracy(build(train_X, train_y, 0, d), test_X, test_y))</code> keeps the first (smallest) maximum. Then <code>tree = build(train_X, train_y, 0, best_depth)</code>.`,
        solution: R`import random
random.seed(1)

def make(n):
    pts, labs = [], []
    for _ in range(n):
        a, b = random.uniform(0, 10), random.uniform(0, 10)
        label = 1 if (a > 4 and b > 3) else 0
        if random.random() < 0.1:
            label = 1 - label          # 10% noise
        pts.append((a, b))
        labs.append(label)
    return pts, labs

train_X, train_y = make(60)
test_X, test_y = make(300)

for d in range(1, 9):
    t = build(train_X, train_y, 0, d)
    print(f"depth {d}: train {accuracy(t, train_X, train_y):.0%}   test {accuracy(t, test_X, test_y):.0%}")

best_depth = max(range(1, 9), key=lambda d: accuracy(build(train_X, train_y, 0, d), test_X, test_y))
tree = build(train_X, train_y, 0, best_depth)
print("best depth:", best_depth)`,
        tests: [
          { name: 'best_depth has the highest test accuracy', check: R`
_accs = [accuracy(build(train_X, train_y, 0, d), test_X, test_y) for d in range(1, 9)]
_best = 1 + _accs.index(max(_accs))
assert best_depth == _best, f"best_depth is {best_depth}, but depth {_best} scores {max(_accs):.0%} on the test points"` },
          { name: 'tree is built with that depth', check: R`assert tree is not None and depth_of(tree) <= best_depth and accuracy(tree, test_X, test_y) == accuracy(build(train_X, train_y, 0, best_depth), test_X, test_y), "build tree with max_depth = best_depth"` },
          { name: 'deeper is not always better', check: R`assert accuracy(build(train_X, train_y, 0, 8), train_X, train_y) >= accuracy(tree, train_X, train_y), "the deepest tree should fit the training points at least as well"` },
        ],
      },
      {
        id: 'sklearn', title: 'Check with scikit-learn',
        brief: R`<p>scikit-learn's <code>DecisionTreeClassifier</code> grows the same kind of tree with Gini impurity. After fitting, <code>model.tree_.feature[0]</code> and <code>model.tree_.threshold[0]</code> are the first question it asks.</p>
          <p>Fit a depth-1 tree on the ten worked-example points and check that its first question matches your <code>best_split</code>. Then fit one with <code>max_depth=best_depth</code> on the noisy training data and score it on the test points with <code>model.score</code>.</p>${NOTE}`,
        starter: R`from sklearn.tree import DecisionTreeClassifier

stump = None     # replace: DecisionTreeClassifier(max_depth=1, random_state=0) fitted on X and ys
model = None     # replace: DecisionTreeClassifier(max_depth=best_depth, random_state=0) fitted on train_X, train_y
sk_acc = None    # replace: model's accuracy on test_X, test_y

f, t, m = best_split(X, ys)
print("first question, mine:         x", f, ">", t)
if stump is not None:
    print("first question, scikit-learn: x", stump.tree_.feature[0], ">", stump.tree_.threshold[0])
print("test accuracy, mine:", f"{accuracy(tree, test_X, test_y):.0%}", " scikit-learn:", sk_acc)`,
        hint: R`<code>stump = DecisionTreeClassifier(max_depth=1, random_state=0).fit(X, ys)</code>, the same with <code>max_depth=best_depth</code> on the training data for <code>model</code>, and <code>sk_acc = model.score(test_X, test_y)</code>.`,
        solution: R`from sklearn.tree import DecisionTreeClassifier

stump = DecisionTreeClassifier(max_depth=1, random_state=0).fit(X, ys)
model = DecisionTreeClassifier(max_depth=best_depth, random_state=0).fit(train_X, train_y)
sk_acc = model.score(test_X, test_y)

f, t, m = best_split(X, ys)
print("first question, mine:         x", f, ">", t)
if stump is not None:
    print("first question, scikit-learn: x", stump.tree_.feature[0], ">", stump.tree_.threshold[0])
print("test accuracy, mine:", f"{accuracy(tree, test_X, test_y):.0%}", " scikit-learn:", f"{sk_acc:.0%}")`,
        tests: [
          { name: 'the same first question', check: R`_f, _t, _m = best_split(X, ys); assert stump is not None and stump.tree_.feature[0] == _f and close(stump.tree_.threshold[0], _t, 1e-9), "fit a depth-1 tree on X and ys"` },
          { name: 'model uses your best depth', check: R`assert model is not None and model.max_depth == best_depth, f"use max_depth=best_depth ({best_depth})"` },
          { name: 'sk_acc is its test accuracy, close to yours', check: R`assert sk_acc is not None and close(sk_acc, model.score(test_X, test_y), 1e-9) and abs(sk_acc - accuracy(tree, test_X, test_y)) <= 0.1, f"scikit-learn {sk_acc}, yours {accuracy(tree, test_X, test_y)}"` },
        ],
      },
    ],
  };
})();
