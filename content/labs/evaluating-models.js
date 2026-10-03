// Coding lab for the Evaluating Models lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  const NOTE = String.raw`<p class="ide-note">The first run downloads scikit-learn into your browser (about 40 MB, once). It can take up to a minute; later runs are instant.</p>`;
  const GIVEN = R`import random, math

# ── Given: data, and the k-nearest-neighbours model from Lesson 4 ───────
def make_points(n, rng, sick_share=0.5):
    # two overlapping groups: label 1 ("sick") and 0 ("healthy")
    X, ys = [], []
    for _ in range(n):
        y = 1 if rng.random() < sick_share else 0
        cx, cy = (0.9, 0.6) if y else (-0.9, -0.6)
        X.append((rng.gauss(cx, 1.1), rng.gauss(cy, 1.1)))
        ys.append(y)
    return X, ys

def knn_score(train_X, train_y, x, k):
    # share of the k nearest training points labelled 1: a score from 0 to 1
    near = sorted(range(len(train_X)), key=lambda i: math.dist(train_X[i], x))[:k]
    return sum(train_y[i] for i in near) / k

def knn_predict(train_X, train_y, x, k):
    return 1 if knn_score(train_X, train_y, x, k) >= 0.5 else 0

X, ys = make_points(200, random.Random(8))
`;
  window.LABS = window.LABS || {};
  window.LABS['evaluating-models'] = {
    file: 'evaluation.py',
    title: 'Build an honest scoreboard',
    intro: R`Thirteen small steps. A k-nearest-neighbours model is given, so you can focus on judging it honestly: splitting data, the confusion matrix, precision and recall, cross-validation, thresholds and the ROC curve. The last step checks your work against scikit-learn.`,
    doneTitle: 'You built an honest scoreboard for machine learning models.',
    doneText: 'Every line below is yours: train and test splits, accuracy, the confusion matrix, precision, recall, F1, cross-validation, thresholds, the ROC curve and its area. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your evaluation toolkit works.',
    steps: [
      {
        id: 'split', title: 'Hold some back',
        brief: R`<p>A model must be judged on data it never trained on. Shuffle the positions with <code>random.Random(seed).shuffle</code>, then put the first part in a training set and the last <code>test_share</code> in a test set.</p>
          <p>Write <code>train_test_split(X, ys, test_share, seed)</code> returning <code>(train_X, train_y, test_X, test_y)</code>. The training set gets <code>int(len(X) * (1 - test_share))</code> points.</p>`,
        starter: GIVEN + R`
# ── Your code ────────────────────────────────────────────────────────────
def train_test_split(X, ys, test_share, seed):
    # shuffle positions, then cut into train and test
    idx = list(range(len(X)))

    return [], [], [], []

train_X, train_y, test_X, test_y = train_test_split(X, ys, 0.3, 1)
print(len(train_X), "to train on,", len(test_X), "to test on")`,
        hint: R`<code>random.Random(seed).shuffle(idx)</code>, <code>cut = int(len(X) * (1 - test_share))</code>, then build the four lists from <code>idx[:cut]</code> and <code>idx[cut:]</code>.`,
        solution: GIVEN + R`
# ── Your code ────────────────────────────────────────────────────────────
def train_test_split(X, ys, test_share, seed):
    # shuffle positions, then cut into train and test
    idx = list(range(len(X)))
    random.Random(seed).shuffle(idx)
    cut = int(len(X) * (1 - test_share))
    tr, te = idx[:cut], idx[cut:]
    return [X[i] for i in tr], [ys[i] for i in tr], [X[i] for i in te], [ys[i] for i in te]

train_X, train_y, test_X, test_y = train_test_split(X, ys, 0.3, 1)
print(len(train_X), "to train on,", len(test_X), "to test on")`,
        tests: [
          { name: '140 to train, 60 to test', check: R`assert len(train_X) == 140 and len(test_X) == 60 and len(train_y) == 140 and len(test_y) == 60, f"got {len(train_X)} and {len(test_X)}"` },
          { name: 'no point is in both', check: R`assert not set(train_X) & set(test_X), "a point appears in both sets"` },
          { name: 'shuffled with the seed', check: R`assert sum(test_y) == 33, f"the test set has {sum(test_y)} label-1 points, expected 33. Shuffle with random.Random(seed)"` },
        ],
      },
      {
        id: 'accuracy', title: 'Too good to be true',
        brief: R`<p>Write <code>accuracy(preds, truth)</code>: the share of predictions that match. Then score a 1-nearest-neighbour model on the points it trained on, and on the test points. The gap is the whole reason for this lesson.</p>`,
        starter: R`def accuracy(preds, truth):
    # share of matching positions
    return 0

train_preds = [knn_predict(train_X, train_y, x, 1) for x in train_X]
test_preds = [knn_predict(train_X, train_y, x, 1) for x in test_X]
print(f"k = 1: training {accuracy(train_preds, train_y):.0%}, test {accuracy(test_preds, test_y):.0%}")`,
        hint: R`<code>return sum(p == t for p, t in zip(preds, truth)) / len(truth)</code>`,
        solution: R`def accuracy(preds, truth):
    # share of matching positions
    return sum(p == t for p, t in zip(preds, truth)) / len(truth)

train_preds = [knn_predict(train_X, train_y, x, 1) for x in train_X]
test_preds = [knn_predict(train_X, train_y, x, 1) for x in test_X]
print(f"k = 1: training {accuracy(train_preds, train_y):.0%}, test {accuracy(test_preds, test_y):.0%}")`,
        tests: [
          { name: 'a small example', check: R`r = accuracy([1, 0, 1, 1], [1, 1, 1, 0]); assert close(r, 0.5, 1e-9), f"got {r}"` },
          { name: 'k = 1 is perfect on its own training points', check: R`assert accuracy(train_preds, train_y) == 1.0, "every training point is its own nearest neighbour"` },
          { name: 'but only 72% on the test points', check: R`r = accuracy(test_preds, test_y); assert close(r, 0.717, 0.001), f"got {r:.3f}"` },
        ],
      },
      {
        id: 'confusion', title: 'The confusion matrix',
        brief: R`<p>Accuracy hides <em>which</em> mistakes a model makes. Count the four kinds of outcome, where 1 means "positive" (sick):</p>
          <table><thead><tr><th></th><th>truly 1</th><th>truly 0</th></tr></thead><tbody>
          <tr><td>predicted 1</td><td>true positive (TP)</td><td>false positive (FP)</td></tr>
          <tr><td>predicted 0</td><td>false negative (FN)</td><td>true negative (TN)</td></tr></tbody></table>
          <p>Write <code>confusion(preds, truth)</code> returning <code>(tp, fp, fn, tn)</code>.</p>`,
        starter: R`def confusion(preds, truth):
    # (true positives, false positives, false negatives, true negatives)
    return 0, 0, 0, 0`,
        hint: R`<code>tp = sum(p == 1 and t == 1 for p, t in zip(preds, truth))</code>, and the same pattern for the other three.`,
        solution: R`def confusion(preds, truth):
    # (true positives, false positives, false negatives, true negatives)
    pairs = list(zip(preds, truth))
    tp = sum(p == 1 and t == 1 for p, t in pairs)
    fp = sum(p == 1 and t == 0 for p, t in pairs)
    fn = sum(p == 0 and t == 1 for p, t in pairs)
    tn = sum(p == 0 and t == 0 for p, t in pairs)
    return tp, fp, fn, tn`,
        tests: [
          { name: 'a small example', check: R`r = confusion([1, 1, 0, 0, 1], [1, 0, 1, 0, 1]); assert tuple(r) == (2, 1, 1, 1), f"got {r}"` },
          { name: 'k = 15 on the test points: (23, 6, 10, 21)', check: R`p = [knn_predict(train_X, train_y, x, 15) for x in test_X]; r = confusion(p, test_y); assert tuple(r) == (23, 6, 10, 21), f"got {r}"` },
        ],
      },
      {
        id: 'precision_recall', title: 'Precision and recall',
        brief: R`<p>Two questions, two numbers:</p>
          \[ \text{precision} = \frac{TP}{TP + FP} \qquad \text{recall} = \frac{TP}{TP + FN} \]
          <p><strong>Precision</strong>: when the model says 1, how often is it right? <strong>Recall</strong>: of all the real 1s, how many did it find? Write both. If the bottom is 0, return 0.</p>`,
        starter: R`def precision(tp, fp):
    # TP / (TP + FP), or 0 if nothing was predicted positive
    return 0

def recall(tp, fn):
    # TP / (TP + FN), or 0 if there are no real positives
    return 0`,
        hint: R`<code>return tp / (tp + fp) if tp + fp else 0</code>, and the same shape for recall.`,
        solution: R`def precision(tp, fp):
    # TP / (TP + FP), or 0 if nothing was predicted positive
    return tp / (tp + fp) if tp + fp else 0

def recall(tp, fn):
    # TP / (TP + FN), or 0 if there are no real positives
    return tp / (tp + fn) if tp + fn else 0`,
        tests: [
          { name: 'precision for (23, 6, 10, 21) is 0.793', check: R`r = precision(23, 6); assert close(r, 0.793, 0.001), f"got {r}"` },
          { name: 'recall for (23, 6, 10, 21) is 0.697', check: R`r = recall(23, 10); assert close(r, 0.697, 0.001), f"got {r}"` },
          { name: 'no positives predicted: precision 0', check: R`assert precision(0, 0) == 0, "avoid dividing by zero"` },
        ],
      },
      {
        id: 'f1', title: 'One number for both',
        brief: R`<p>The <strong>F1 score</strong> combines precision and recall. It is their harmonic mean, which stays low if either one is low:</p>
          \[ F_1 = \frac{2 \times \text{precision} \times \text{recall}}{\text{precision} + \text{recall}} \]
          <p>Write <code>f1(p, r)</code>, returning 0 when both are 0.</p>`,
        starter: R`def f1(p, r):
    # 2pr / (p + r)
    return 0`,
        hint: R`<code>return 2 * p * r / (p + r) if p + r else 0</code>`,
        solution: R`def f1(p, r):
    # 2pr / (p + r)
    return 2 * p * r / (p + r) if p + r else 0`,
        tests: [
          { name: 'equal precision and recall give the same F1', check: R`assert close(f1(0.6, 0.6), 0.6, 1e-9), f"got {f1(0.6, 0.6)}"` },
          { name: 'a lopsided model is punished', check: R`r = f1(1.0, 0.1); assert close(r, 0.182, 0.001), f"got {r}. The plain average would be 0.55"` },
          { name: 'both zero gives zero', check: R`assert f1(0, 0) == 0, "avoid dividing by zero"` },
        ],
      },
      {
        id: 'folds', title: 'Cut into folds',
        brief: R`<p>One test set gives one noisy score. <strong>Cross-validation</strong> cuts the training data into \(k\) folds and lets each fold take a turn as the test set.</p>
          <p>Write <code>k_folds(n, k)</code> returning \(k\) lists of positions, where fold \(i\) holds positions \(i, i + k, i + 2k, \dots\) (every \(k\)-th one, starting at \(i\)).</p>`,
        starter: R`def k_folds(n, k):
    # fold i: positions i, i + k, i + 2k, ...
    return []`,
        hint: R`<code>return [list(range(i, n, k)) for i in range(k)]</code>`,
        solution: R`def k_folds(n, k):
    # fold i: positions i, i + k, i + 2k, ...
    return [list(range(i, n, k)) for i in range(k)]`,
        tests: [
          { name: '10 positions in 3 folds', check: R`r = k_folds(10, 3); assert r == [[0, 3, 6, 9], [1, 4, 7], [2, 5, 8]], f"got {r}"` },
          { name: 'every position is in exactly one fold', check: R`r = k_folds(140, 5); assert sorted(i for f in r for i in f) == list(range(140)), "positions missing or repeated"` },
        ],
      },
      {
        id: 'cross_val', title: 'Cross-validate',
        brief: R`<p>For each fold: train on every other fold, test on this one, and record the accuracy. The cross-validated score is the average over all folds:</p>
          \[ \text{CV score} = \frac{\text{score}_1 + \text{score}_2 + \dots + \text{score}_k}{k} \]
          <p>Write <code>cross_val_accuracy(X, ys, k_neighbours, n_folds)</code> using <code>k_folds</code> and <code>knn_predict</code>.</p>`,
        starter: R`def cross_val_accuracy(X, ys, k_neighbours, n_folds):
    # average test accuracy over the folds
    scores = []
    for fold in k_folds(len(X), n_folds):
        held = set(fold)
        # train on positions not in held, predict the positions in fold

    return sum(scores) / len(scores) if scores else 0`,
        hint: R`Inside the loop: <code>tx = [X[i] for i in range(len(X)) if i not in held]</code>, <code>ty</code> likewise, <code>preds = [knn_predict(tx, ty, X[i], k_neighbours) for i in fold]</code>, then <code>scores.append(accuracy(preds, [ys[i] for i in fold]))</code>.`,
        solution: R`def cross_val_accuracy(X, ys, k_neighbours, n_folds):
    # average test accuracy over the folds
    scores = []
    for fold in k_folds(len(X), n_folds):
        held = set(fold)
        tx = [X[i] for i in range(len(X)) if i not in held]
        ty = [ys[i] for i in range(len(X)) if i not in held]
        preds = [knn_predict(tx, ty, X[i], k_neighbours) for i in fold]
        scores.append(accuracy(preds, [ys[i] for i in fold]))
    return sum(scores) / len(scores) if scores else 0`,
        tests: [
          { name: 'k = 1 scores 0.829 across 5 folds', check: R`r = cross_val_accuracy(train_X, train_y, 1, 5); assert close(r, 0.829, 0.001), f"got {r:.3f}"` },
          { name: 'k = 9 scores 0.886', check: R`r = cross_val_accuracy(train_X, train_y, 9, 5); assert close(r, 0.886, 0.001), f"got {r:.3f}"` },
        ],
      },
      {
        id: 'choose_k', title: 'Choose k honestly',
        brief: R`<p>Pick the number of neighbours by cross-validation on the <strong>training set only</strong>, so the test set stays untouched for the final check.</p>
          <p>Set <code>best_k</code> to the value in <code>candidates</code> with the highest cross-validated accuracy (5 folds; the first one on ties), then report its accuracy on the test set.</p>`,
        starter: R`candidates = [1, 3, 5, 9, 15, 25, 45]
for k in candidates:
    print(f"k = {k:>2}: cross-validated accuracy {cross_val_accuracy(train_X, train_y, k, 5):.3f}")

best_k = None      # replace: the candidate with the best cross-validated accuracy
final = None       # replace: accuracy of knn_predict with best_k on the test set
print("chosen k:", best_k, " test accuracy:", final)`,
        hint: R`<code>best_k = max(candidates, key=lambda k: cross_val_accuracy(train_X, train_y, k, 5))</code> keeps the first maximum. Then <code>final = accuracy([knn_predict(train_X, train_y, x, best_k) for x in test_X], test_y)</code>.`,
        solution: R`candidates = [1, 3, 5, 9, 15, 25, 45]
for k in candidates:
    print(f"k = {k:>2}: cross-validated accuracy {cross_val_accuracy(train_X, train_y, k, 5):.3f}")

best_k = max(candidates, key=lambda k: cross_val_accuracy(train_X, train_y, k, 5))
final = accuracy([knn_predict(train_X, train_y, x, best_k) for x in test_X], test_y)
print("chosen k:", best_k, " test accuracy:", final)`,
        tests: [
          { name: 'cross-validation chooses k = 9', check: R`assert best_k == 9, f"got {best_k}"` },
          { name: 'final is the test accuracy for that k', check: R`assert final is not None and close(final, accuracy([knn_predict(train_X, train_y, x, best_k) for x in test_X], test_y), 1e-9), f"got {final}"` },
        ],
      },
      {
        id: 'threshold', title: 'Move the threshold',
        brief: R`<p><code>knn_score</code> gives a score from 0 to 1. Saying 1 when the score is at least 0.5 is only one choice. A lower threshold catches more real positives (higher recall) but raises more false alarms (lower precision).</p>
          <p>Write <code>predict_at(scores, t)</code> returning 1 for each score of at least <code>t</code>, else 0.</p>`,
        starter: R`def predict_at(scores, t):
    # 1 where score >= t
    return []

scores = [knn_score(train_X, train_y, x, 15) for x in test_X]
for t in (0.8, 0.5, 0.2):
    tp, fp, fn, tn = confusion(predict_at(scores, t), test_y)
    print(f"threshold {t}: precision {precision(tp, fp):.2f}, recall {recall(tp, fn):.2f}")`,
        hint: R`<code>return [1 if s >= t else 0 for s in scores]</code>`,
        solution: R`def predict_at(scores, t):
    # 1 where score >= t
    return [1 if s >= t else 0 for s in scores]

scores = [knn_score(train_X, train_y, x, 15) for x in test_X]
for t in (0.8, 0.5, 0.2):
    tp, fp, fn, tn = confusion(predict_at(scores, t), test_y)
    print(f"threshold {t}: precision {precision(tp, fp):.2f}, recall {recall(tp, fn):.2f}")`,
        tests: [
          { name: 'a small example', check: R`assert predict_at([0.1, 0.5, 0.9], 0.5) == [0, 1, 1], f"got {predict_at([0.1, 0.5, 0.9], 0.5)}"` },
          { name: 'lowering the threshold raises recall', check: R`rs = [recall(*[confusion(predict_at(scores, t), test_y)[i] for i in (0, 2)]) for t in (0.8, 0.5, 0.2)]; assert rs[0] <= rs[1] <= rs[2] and rs[0] < rs[2], f"recalls {rs}"` },
        ],
      },
      {
        id: 'roc', title: 'Every threshold at once',
        brief: R`<p>The <strong>ROC curve</strong> shows every threshold together. For each threshold, plot the false-positive rate against the true-positive rate (which is the recall):</p>
          \[ \text{FPR} = \frac{FP}{FP + TN} \qquad \text{TPR} = \frac{TP}{TP + FN} \]
          <p>Write <code>roc_points(scores, truth)</code>: start at <code>(0, 0)</code>, then add one <code>(fpr, tpr)</code> point for each distinct score used as the threshold, from the highest score to the lowest. The last point is <code>(1, 1)</code>.</p>`,
        starter: R`def roc_points(scores, truth):
    # (FPR, TPR) for each distinct score as threshold, highest first, after (0, 0)
    points = [(0.0, 0.0)]

    return points`,
        hint: R`Loop <code>for t in sorted(set(scores), reverse=True):</code>, get <code>tp, fp, fn, tn = confusion(predict_at(scores, t), truth)</code>, and append <code>(fp / (fp + tn), tp / (tp + fn))</code>.`,
        solution: R`def roc_points(scores, truth):
    # (FPR, TPR) for each distinct score as threshold, highest first, after (0, 0)
    points = [(0.0, 0.0)]
    for t in sorted(set(scores), reverse=True):
        tp, fp, fn, tn = confusion(predict_at(scores, t), truth)
        points.append((fp / (fp + tn), tp / (tp + fn)))
    return points`,
        tests: [
          { name: 'a small example', check: R`r = roc_points([0.9, 0.4, 0.6, 0.1], [1, 0, 1, 0]); assert r == [(0.0, 0.0), (0.0, 0.5), (0.0, 1.0), (0.5, 1.0), (1.0, 1.0)], f"got {r}"` },
          { name: 'ends at (1, 1)', check: R`r = roc_points(scores, test_y); assert r[-1] == (1.0, 1.0) and len(r) == 15, f"last point {r[-1]}, {len(r)} points"` },
        ],
      },
      {
        id: 'auc', title: 'The area under the curve',
        brief: R`<p>The <strong>AUC</strong>, the area under the ROC curve, sums up the whole curve: 1.0 is perfect, 0.5 is coin-tossing. Add up the area of the trapezium between each pair of neighbouring points:</p>
          \[ \text{area} = (x_2 - x_1) \times \frac{y_1 + y_2}{2} \]
          <p>Write <code>auc(points)</code>.</p>`,
        starter: R`def auc(points):
    # sum of trapezium areas between neighbouring points
    return 0

print("AUC:", round(auc(roc_points(scores, test_y)), 3))`,
        hint: R`<code>return sum((x2 - x1) * (y1 + y2) / 2 for (x1, y1), (x2, y2) in zip(points, points[1:]))</code>`,
        solution: R`def auc(points):
    # sum of trapezium areas between neighbouring points
    return sum((x2 - x1) * (y1 + y2) / 2 for (x1, y1), (x2, y2) in zip(points, points[1:]))

print("AUC:", round(auc(roc_points(scores, test_y)), 3))`,
        tests: [
          { name: 'a perfect ranking scores 1', check: R`r = auc([(0, 0), (0, 1), (1, 1)]); assert close(r, 1.0, 1e-9), f"got {r}"` },
          { name: 'a coin toss scores 0.5', check: R`r = auc([(0, 0), (1, 1)]); assert close(r, 0.5, 1e-9), f"got {r}"` },
          { name: 'the k = 15 model scores 0.868', check: R`r = auc(roc_points(scores, test_y)); assert close(r, 0.868, 0.001), f"got {r:.3f}"` },
        ],
      },
      {
        id: 'use', title: 'When accuracy lies',
        brief: R`<p>A screening test for a rare illness: 300 people, and only about 8% are sick. A lazy model that says "healthy" to everyone looks excellent on accuracy, yet finds nobody.</p>
          <p>Fill in the lazy model's accuracy and recall, then find the <strong>highest</strong> threshold (from <code>thresholds</code>) at which the KNN model's recall on the test set reaches at least 0.8.</p>`,
        starter: R`dX, dy = make_points(300, random.Random(21), sick_share=0.08)
dtr_X, dtr_y, dte_X, dte_y = train_test_split(dX, dy, 0.3, 2)
print(sum(dte_y), "sick people among", len(dte_y), "in the test set")

lazy = [0] * len(dte_y)                 # "everyone is healthy"
lazy_acc = None                         # replace: accuracy of lazy
lazy_rec = None                         # replace: recall of lazy

d_scores = [knn_score(dtr_X, dtr_y, x, 15) for x in dte_X]
thresholds = [0.5, 0.4, 0.3, 0.2, 0.1]
chosen = None                           # replace: highest threshold with recall >= 0.8

print(f"lazy model: accuracy {lazy_acc}, recall {lazy_rec}")
print("threshold chosen for recall >= 0.8:", chosen)`,
        hint: R`<code>tp, fp, fn, tn = confusion(lazy, dte_y)</code> gives the lazy model's counts. For the threshold: <code>chosen = next(t for t in thresholds if recall(*[confusion(predict_at(d_scores, t), dte_y)[i] for i in (0, 2)]) >= 0.8)</code>, or a plain loop that stops at the first match.`,
        solution: R`dX, dy = make_points(300, random.Random(21), sick_share=0.08)
dtr_X, dtr_y, dte_X, dte_y = train_test_split(dX, dy, 0.3, 2)
print(sum(dte_y), "sick people among", len(dte_y), "in the test set")

lazy = [0] * len(dte_y)                 # "everyone is healthy"
tp, fp, fn, tn = confusion(lazy, dte_y)
lazy_acc = accuracy(lazy, dte_y)
lazy_rec = recall(tp, fn)

d_scores = [knn_score(dtr_X, dtr_y, x, 15) for x in dte_X]
thresholds = [0.5, 0.4, 0.3, 0.2, 0.1]
chosen = None
for t in thresholds:
    tp, fp, fn, tn = confusion(predict_at(d_scores, t), dte_y)
    if recall(tp, fn) >= 0.8:
        chosen = t
        break

print(f"lazy model: accuracy {lazy_acc}, recall {lazy_rec}")
print("threshold chosen for recall >= 0.8:", chosen)`,
        tests: [
          { name: 'the lazy model looks accurate', check: R`assert lazy_acc is not None and lazy_acc > 0.85, f"lazy accuracy {lazy_acc}"` },
          { name: 'but finds nobody', check: R`assert lazy_rec == 0, f"lazy recall {lazy_rec}"` },
          { name: 'the chosen threshold reaches recall 0.8', check: R`
_ok = [t for t in thresholds if recall(*[confusion(predict_at(d_scores, t), dte_y)[i] for i in (0, 2)]) >= 0.8]
assert chosen == _ok[0], f"chosen {chosen}, but the highest threshold reaching 0.8 is {_ok[0]}"` },
        ],
      },
      {
        id: 'sklearn', title: 'Check with scikit-learn',
        brief: R`<p>scikit-learn's <code>sklearn.metrics</code> has every number from this lesson. Compute its confusion matrix, precision, recall and AUC for the k = 15 model and compare with yours. Note its confusion matrix is laid out as <code>[[TN, FP], [FN, TP]]</code>.</p>${NOTE}`,
        starter: R`from sklearn.metrics import confusion_matrix, precision_score, recall_score, roc_auc_score

preds15 = predict_at(scores, 0.5)
sk_matrix = None     # replace: confusion_matrix(test_y, preds15)
sk_precision = None  # replace: precision_score(test_y, preds15)
sk_recall = None     # replace: recall_score(test_y, preds15)
sk_auc = None        # replace: roc_auc_score(test_y, scores)

tp, fp, fn, tn = confusion(preds15, test_y)
print("mine:        ", (tp, fp, fn, tn), round(precision(tp, fp), 3), round(recall(tp, fn), 3), round(auc(roc_points(scores, test_y)), 3))
print("scikit-learn:", sk_matrix if sk_matrix is None else sk_matrix.tolist(), sk_precision, sk_recall, sk_auc)`,
        hint: R`Pass the true labels first: <code>confusion_matrix(test_y, preds15)</code>, <code>precision_score(test_y, preds15)</code>, <code>recall_score(test_y, preds15)</code>, and the scores (not the 0/1 predictions) to <code>roc_auc_score(test_y, scores)</code>.`,
        solution: R`from sklearn.metrics import confusion_matrix, precision_score, recall_score, roc_auc_score

preds15 = predict_at(scores, 0.5)
sk_matrix = confusion_matrix(test_y, preds15)
sk_precision = precision_score(test_y, preds15)
sk_recall = recall_score(test_y, preds15)
sk_auc = roc_auc_score(test_y, scores)

tp, fp, fn, tn = confusion(preds15, test_y)
print("mine:        ", (tp, fp, fn, tn), round(precision(tp, fp), 3), round(recall(tp, fn), 3), round(auc(roc_points(scores, test_y)), 3))
print("scikit-learn:", sk_matrix if sk_matrix is None else sk_matrix.tolist(), sk_precision, sk_recall, sk_auc)`,
        tests: [
          { name: 'same confusion matrix', check: R`tp, fp, fn, tn = confusion(predict_at(scores, 0.5), test_y); assert sk_matrix is not None and sk_matrix.tolist() == [[tn, fp], [fn, tp]], f"scikit-learn {sk_matrix}"` },
          { name: 'same precision and recall', check: R`tp, fp, fn, tn = confusion(predict_at(scores, 0.5), test_y); assert close(sk_precision, precision(tp, fp), 1e-9) and close(sk_recall, recall(tp, fn), 1e-9), f"scikit-learn {sk_precision}, {sk_recall}"` },
          { name: 'same AUC', check: R`assert close(sk_auc, auc(roc_points(scores, test_y)), 1e-9), f"scikit-learn {sk_auc}"` },
        ],
      },
    ],
  };
})();
