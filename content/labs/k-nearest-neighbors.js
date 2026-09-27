// Coding lab for the K-Nearest Neighbors lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  window.LABS = window.LABS || {};
  window.LABS['k-nearest-neighbors'] = {
    file: 'knn.py',
    title: 'Write k-nearest neighbours from scratch',
    intro: R`Twelve small steps: measure distances, find the nearest points, let them vote, pick a good k, and rescale the measurements so each one counts fairly. Plain Python, with only the built-in <code>math</code> module.`,
    doneTitle: 'You wrote k-nearest neighbours from scratch.',
    doneText: 'Every line below is yours: distances, the nearest neighbours, the vote, choosing k, and rescaling. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your k-nearest neighbours works.',
    steps: [
      {
        id: 'data', title: 'Store the points',
        brief: R`<p>Six labelled points from the worked example, and a stranger to classify:</p>
          <ul><li>blue: \((1, 1)\), \((2, 1.5)\), \((1.5, 3)\)</li><li>red: \((5, 4)\), \((6, 5)\), \((4.5, 6)\)</li><li>stranger: \((3.5, 3)\)</li></ul>
          <p>Store the points in <code>points</code> (in that order), their colours in <code>labels</code>, and the stranger in <code>query</code>.</p>`,
        starter: R`points = []
labels = []
query = ()`,
        hint: R`<code>points = [(1, 1), (2, 1.5), (1.5, 3), (5, 4), (6, 5), (4.5, 6)]</code>, <code>labels = ["blue"] * 3 + ["red"] * 3</code>.`,
        solution: R`points = [(1, 1), (2, 1.5), (1.5, 3), (5, 4), (6, 5), (4.5, 6)]
labels = ["blue", "blue", "blue", "red", "red", "red"]
query = (3.5, 3)`,
        tests: [
          { name: 'six points in order', check: R`assert [tuple(p) for p in points] == [(1, 1), (2, 1.5), (1.5, 3), (5, 4), (6, 5), (4.5, 6)], f"points is {points!r}"` },
          { name: 'three blue, then three red', check: R`assert list(labels) == ["blue"] * 3 + ["red"] * 3, f"labels is {labels!r}"` },
          { name: 'the stranger is (3.5, 3)', check: R`assert tuple(query) == (3.5, 3), f"query is {query!r}"` },
        ],
      },
      {
        id: 'distance', title: 'Distance between two points',
        brief: R`<p>The straight-line distance, from Pythagoras:</p>
          \[ d = \sqrt{(x_1 - q_1)^2 + (x_2 - q_2)^2} \]
          <p>Write <code>distance(p, q)</code> for two points given as pairs. <code>math.sqrt</code> takes a square root.</p>`,
        starter: R`import math

def distance(p, q):
    # sqrt((p1 - q1)^2 + (p2 - q2)^2)
    return 0`,
        hint: R`<code>return math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2)</code>`,
        solution: R`import math

def distance(p, q):
    # sqrt((p1 - q1)^2 + (p2 - q2)^2)
    return math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2)`,
        tests: [
          { name: 'the 3-4-5 triangle', check: R`r = distance((0, 0), (3, 4)); assert close(r, 5, 1e-9), f"got {r}, expected 5"` },
          { name: 'order does not matter', check: R`assert close(distance((1, 2), (4, 6)), distance((4, 6), (1, 2)), 1e-9), "distance(p, q) should equal distance(q, p)"` },
          { name: 'stranger to (5, 4) is 1.80', check: R`r = distance((5, 4), query); assert close(r, 1.803, 0.001), f"got {r}, expected √(1.5² + 1²) = 1.803"` },
        ],
      },
      {
        id: 'all_distances', title: 'Distance to every point',
        brief: R`<p>Write <code>all_distances(points, q)</code> that returns a list with the distance from <code>q</code> to each point, in the same order.</p>`,
        starter: R`def all_distances(points, q):
    # one distance per point
    return []`,
        hint: R`<code>return [distance(p, q) for p in points]</code>`,
        solution: R`def all_distances(points, q):
    # one distance per point
    return [distance(p, q) for p in points]`,
        tests: [
          { name: 'one distance per point', check: R`r = all_distances(points, query); assert len(r) == 6, f"got {len(r)} distances"` },
          { name: 'values match the worked example', check: R`r = all_distances(points, query); assert all(close(a, b, 0.001) for a, b in zip(r, [3.202, 2.121, 2.0, 1.803, 3.202, 3.162])), f"got {[round(v, 3) for v in r]}"` },
        ],
      },
      {
        id: 'nearest', title: 'The k nearest',
        brief: R`<p>Sort the points by distance and keep the closest \(k\). Return their <strong>labels</strong>, nearest first.</p>
          <p>Write <code>nearest(points, labels, q, k)</code>. Tip: sort pairs of <code>(distance, label)</code>, since Python sorts pairs by their first item.</p>`,
        starter: R`def nearest(points, labels, q, k):
    # labels of the k closest points, nearest first
    return []`,
        hint: R`<code>pairs = sorted(zip(all_distances(points, q), labels))</code>, then <code>return [label for d, label in pairs[:k]]</code>.`,
        solution: R`def nearest(points, labels, q, k):
    # labels of the k closest points, nearest first
    pairs = sorted(zip(all_distances(points, q), labels))
    return [label for d, label in pairs[:k]]`,
        tests: [
          { name: 'the single nearest is red', check: R`r = nearest(points, labels, query, 1); assert list(r) == ["red"], f"got {r}"` },
          { name: 'the three nearest are red, blue, blue', check: R`r = nearest(points, labels, query, 3); assert list(r) == ["red", "blue", "blue"], f"got {r}"` },
          { name: 'k controls how many come back', check: R`assert len(nearest(points, labels, query, 4)) == 4, "asked for 4 neighbours"` },
        ],
      },
      {
        id: 'vote', title: 'The vote',
        brief: R`<p>The most common label wins. Write <code>vote(neighbour_labels)</code>.</p>
          <p>Count each label in a dictionary, then return the one with the biggest count.</p>`,
        starter: R`def vote(neighbour_labels):
    # the most common label
    counts = {}

    return None`,
        hint: R`Loop and do <code>counts[l] = counts.get(l, 0) + 1</code>, then <code>return max(counts, key=counts.get)</code>.`,
        solution: R`def vote(neighbour_labels):
    # the most common label
    counts = {}
    for l in neighbour_labels:
        counts[l] = counts.get(l, 0) + 1
    return max(counts, key=counts.get)`,
        tests: [
          { name: 'two blue beat one red', check: R`r = vote(["red", "blue", "blue"]); assert r == "blue", f"got {r!r}"` },
          { name: 'a single voter wins', check: R`r = vote(["red"]); assert r == "red", f"got {r!r}"` },
          { name: 'works for any labels', check: R`r = vote(["cat", "dog", "cat", "cat", "dog"]); assert r == "cat", f"got {r!r}"` },
        ],
      },
      {
        id: 'predict', title: 'Predict',
        brief: R`<p>Put the two together: find the \(k\) nearest labels, then vote. Write <code>predict(points, labels, q, k)</code>.</p>
          <p>For the stranger, \(k = 1\) says red but \(k = 3\) says blue. The choice of \(k\) matters.</p>`,
        starter: R`def predict(points, labels, q, k):
    # nearest labels, then the vote
    return None`,
        hint: R`<code>return vote(nearest(points, labels, q, k))</code>`,
        solution: R`def predict(points, labels, q, k):
    # nearest labels, then the vote
    return vote(nearest(points, labels, q, k))`,
        tests: [
          { name: 'k = 1 says red', check: R`r = predict(points, labels, query, 1); assert r == "red", f"got {r!r}"` },
          { name: 'k = 3 says blue', check: R`r = predict(points, labels, query, 3); assert r == "blue", f"got {r!r}"` },
          { name: 'a point deep in the red group is red', check: R`r = predict(points, labels, (6, 6), 3); assert r == "red", f"got {r!r}"` },
        ],
      },
      {
        id: 'accuracy', title: 'How often is it right?',
        brief: R`<p>To judge a value of \(k\), predict points whose labels we already know and count the hits:</p>
          \[ \text{accuracy} = \frac{\text{correct predictions}}{\text{number of test points}} \]
          <p>Write <code>accuracy(points, labels, test_points, test_labels, k)</code>.</p>`,
        starter: R`def accuracy(points, labels, test_points, test_labels, k):
    # share of test points predicted correctly
    return 0`,
        hint: R`<code>hits = sum(predict(points, labels, q, k) == t for q, t in zip(test_points, test_labels))</code>, then divide by <code>len(test_labels)</code>.`,
        solution: R`def accuracy(points, labels, test_points, test_labels, k):
    # share of test points predicted correctly
    hits = sum(predict(points, labels, q, k) == t for q, t in zip(test_points, test_labels))
    return hits / len(test_labels)`,
        tests: [
          { name: 'all right gives 1.0', check: R`r = accuracy(points, labels, [(1, 1.2), (6, 5.5)], ["blue", "red"], 1); assert close(r, 1.0, 1e-9), f"got {r}"` },
          { name: 'half right gives 0.5', check: R`r = accuracy(points, labels, [(1, 1.2), (6, 5.5)], ["blue", "blue"], 1); assert close(r, 0.5, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'best_k', title: 'Choose k',
        brief: R`<p>Try several values of \(k\) and keep the one with the best accuracy on points the model has not seen. If two tie, keep the smaller \(k\).</p>
          <p>Write <code>best_k(points, labels, test_points, test_labels, ks)</code>, where <code>ks</code> is a list such as <code>[1, 3, 5]</code>.</p>`,
        starter: R`def best_k(points, labels, test_points, test_labels, ks):
    # the k with the highest accuracy (smallest k on ties)
    return ks[0]`,
        hint: R`Loop over <code>ks</code> and keep a <code>best</code> and a <code>best_acc</code>. Update only when the accuracy is strictly bigger, so earlier (smaller) k values win ties.`,
        solution: R`def best_k(points, labels, test_points, test_labels, ks):
    # the k with the highest accuracy (smallest k on ties)
    best, best_acc = ks[0], -1
    for k in ks:
        acc = accuracy(points, labels, test_points, test_labels, k)
        if acc > best_acc:
            best, best_acc = k, acc
    return best`,
        tests: [
          { name: 'picks the k that scores best', check: R`r = best_k(points, labels, [(3.5, 3)], ["blue"], [1, 3]); assert r == 3, f"got {r}. k = 3 predicts blue for the stranger, k = 1 does not"` },
          { name: 'ties go to the smaller k', check: R`r = best_k(points, labels, [(1, 1.2)], ["blue"], [1, 3]); assert r == 1, f"got {r}"` },
        ],
      },
      {
        id: 'ranges', title: 'Find each measurement’s range',
        brief: R`<p>Distances are only fair if every measurement uses a similar scale. First find the smallest and largest value of each measurement.</p>
          <p>Write <code>ranges(points)</code> returning <code>(mins, maxs)</code>, two lists with one entry per measurement.</p>`,
        starter: R`def ranges(points):
    # ([min of x1, min of x2], [max of x1, max of x2])
    return [], []`,
        hint: R`<code>mins = [min(p[i] for p in points) for i in range(2)]</code>, and the same with <code>max</code>.`,
        solution: R`def ranges(points):
    # ([min of x1, min of x2], [max of x1, max of x2])
    mins = [min(p[i] for p in points) for i in range(2)]
    maxs = [max(p[i] for p in points) for i in range(2)]
    return mins, maxs`,
        tests: [
          { name: 'ranges of the six points', check: R`mn, mx = ranges(points); assert list(mn) == [1, 1] and list(mx) == [6, 6], f"got mins {mn}, maxs {mx}"` },
        ],
      },
      {
        id: 'rescale', title: 'Rescale one point',
        brief: R`<p>Squeeze every measurement into the range 0 to 1:</p>
          \[ x' = \frac{x - \min}{\max - \min} \]
          <p>Write <code>rescale(p, mins, maxs)</code> that returns the rescaled point as a tuple.</p>`,
        starter: R`def rescale(p, mins, maxs):
    # (x - min) / (max - min) for each measurement
    return p`,
        hint: R`<code>return tuple((p[i] - mins[i]) / (maxs[i] - mins[i]) for i in range(2))</code>`,
        solution: R`def rescale(p, mins, maxs):
    # (x - min) / (max - min) for each measurement
    return tuple((p[i] - mins[i]) / (maxs[i] - mins[i]) for i in range(2))`,
        tests: [
          { name: 'the minimum becomes 0 and the maximum 1', check: R`r = rescale((1, 6), [1, 1], [6, 6]); assert close(r[0], 0, 1e-9) and close(r[1], 1, 1e-9), f"got {r}"` },
          { name: 'the middle becomes 0.5', check: R`r = rescale((20, 300), [10, 100], [30, 500]); assert close(r[0], 0.5, 1e-9) and close(r[1], 0.5, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'rescale_all', title: 'Rescale everything',
        brief: R`<p>Rescale a whole list of points with the same <code>mins</code> and <code>maxs</code>. New points you ask about must be rescaled with these same numbers too.</p>
          <p>Write <code>rescale_all(points, mins, maxs)</code>.</p>`,
        starter: R`def rescale_all(points, mins, maxs):
    # rescale every point with the same mins and maxs
    return points`,
        hint: R`<code>return [rescale(p, mins, maxs) for p in points]</code>`,
        solution: R`def rescale_all(points, mins, maxs):
    # rescale every point with the same mins and maxs
    return [rescale(p, mins, maxs) for p in points]`,
        tests: [
          { name: 'every value lands between 0 and 1', check: R`mn, mx = ranges(points); r = rescale_all(points, mn, mx); assert len(r) == 6 and all(0 <= v <= 1 for p in r for v in p), f"got {r}"` },
        ],
      },
      {
        id: 'use', title: 'Put it to work',
        brief: R`<p>A shop records each customer's age and yearly income, and whether they bought a product. Will a 30-year-old earning 62,000 buy?</p>
          <p>Predict with \(k = 3\) twice: once on the raw numbers, and once after rescaling (rescale the customers and the new customer with the same ranges). Replace the three placeholder lines and compare.</p>`,
        starter: R`# (age, yearly income) and whether they bought
customers = [(22, 25000), (25, 32000), (47, 85000), (52, 110000), (46, 62000),
             (56, 64000), (28, 70000), (33, 40000), (58, 30000), (61, 42000)]
bought = ["no", "no", "yes", "yes", "yes", "yes", "no", "no", "yes", "yes"]
new = (30, 62000)

raw_guess = None        # replace: predict on the raw numbers, k = 3
mins, maxs = [], []     # replace: the ranges of the customers
scaled_guess = None     # replace: predict after rescaling, k = 3

print("raw numbers:", raw_guess, " nearest:", nearest(customers, bought, new, 3))
print("rescaled:   ", scaled_guess)`,
        hint: R`<code>raw_guess = predict(customers, bought, new, 3)</code>, <code>mins, maxs = ranges(customers)</code>, and <code>scaled_guess = predict(rescale_all(customers, mins, maxs), bought, rescale(new, mins, maxs), 3)</code>.`,
        solution: R`# (age, yearly income) and whether they bought
customers = [(22, 25000), (25, 32000), (47, 85000), (52, 110000), (46, 62000),
             (56, 64000), (28, 70000), (33, 40000), (58, 30000), (61, 42000)]
bought = ["no", "no", "yes", "yes", "yes", "yes", "no", "no", "yes", "yes"]
new = (30, 62000)

raw_guess = predict(customers, bought, new, 3)
mins, maxs = ranges(customers)
scaled_guess = predict(rescale_all(customers, mins, maxs), bought, rescale(new, mins, maxs), 3)

print("raw numbers:", raw_guess, " nearest:", nearest(customers, bought, new, 3))
print("rescaled:   ", scaled_guess)`,
        tests: [
          { name: 'raw prediction uses income only, and says yes', check: R`assert raw_guess == "yes", f"raw_guess is {raw_guess!r}, expected 'yes'"` },
          { name: 'ranges come from the customers', check: R`assert list(mins) == [22, 25000] and list(maxs) == [61, 110000], f"got {mins}, {maxs}"` },
          { name: 'after rescaling, age counts too, and the answer is no', check: R`assert scaled_guess == "no", f"scaled_guess is {scaled_guess!r}, expected 'no'. Did you rescale the new customer with the same mins and maxs?"` },
        ],
      },
    ],
  };
})();
