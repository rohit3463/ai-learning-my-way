// Coding lab for Lesson 0: the math toolkit.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  const NOTE = String.raw`<p class="ide-note">The first run downloads numpy into your browser (a few MB, once). Later runs are instant.</p>`;
  window.LABS = window.LABS || {};
  window.LABS['math-toolkit'] = {
    file: 'toolkit.py',
    title: 'Build your math toolkit',
    intro: R`Thirteen small steps, each one a tool you will use again: vectors, distance, similarity, matrices, slopes and chances. Every function works for lists of any length, not just two numbers. The last step checks your tools against numpy.`,
    doneTitle: 'Your toolkit is complete.',
    doneText: 'Every function below is yours, and every lesson that follows uses them: vectors, lengths, distances, dot products, matrices, derivatives, probability and a first taste of gradient descent. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your toolkit is ready.',
    steps: [
      {
        id: 'add', title: 'Add two vectors',
        brief: R`<p>A drone flies 3 east and 2 north, then 1 east and 2 north. Where does it end up?</p>
          <p>A vector is a list of numbers. To add two vectors, add the numbers in matching positions:</p>
          \[ (3, 2) + (1, 2) = (3 + 1,\ 2 + 2) = (4, 4) \]
          <p>Write <code>add(u, v)</code>. It should work for lists of any length.</p>`,
        starter: R`def add(u, v):
    # add matching entries
    return []`,
        hint: R`<code>zip(u, v)</code> pairs up matching entries: <code>return [a + b for a, b in zip(u, v)]</code>.`,
        solution: R`def add(u, v):
    # add matching entries
    return [a + b for a, b in zip(u, v)]`,
        tests: [
          { name: 'the drone ends at (4, 4)', check: R`r = add([3, 2], [1, 2]); assert list(r) == [4, 4], f"got {r}"` },
          { name: 'works in three dimensions', check: R`r = add([1, 2, 3], [10, 20, 30]); assert list(r) == [11, 22, 33], f"got {r}"` },
        ],
      },
      {
        id: 'scale', title: 'Stretch a vector',
        brief: R`<p>Double the drone's speed: multiply every number by 2. A negative number flips the direction.</p>
          \[ 2 \times (3, 2) = (6, 4) \qquad -1 \times (3, 2) = (-3, -2) \]
          <p>Write <code>scale(c, v)</code>.</p>`,
        starter: R`def scale(c, v):
    # multiply every entry by c
    return []`,
        hint: R`<code>return [c * x for x in v]</code>`,
        solution: R`def scale(c, v):
    # multiply every entry by c
    return [c * x for x in v]`,
        tests: [
          { name: 'double (3, 2)', check: R`r = scale(2, [3, 2]); assert list(r) == [6, 4], f"got {r}"` },
          { name: 'flip it around', check: R`r = scale(-1, [3, 2]); assert list(r) == [-3, -2], f"got {r}"` },
        ],
      },
      {
        id: 'length', title: 'How long is the trip?',
        brief: R`<p>How far is the drone from home at \((4, 4)\)? Across and up make a right triangle, so Pythagoras gives the length:</p>
          \[ |v| = \sqrt{v_1^2 + v_2^2 + \dots + v_n^2} \]
          <p>Write <code>length(v)</code> using <code>math.sqrt</code>.</p>`,
        starter: R`import math

def length(v):
    # square root of the sum of squares
    return 0`,
        hint: R`<code>return math.sqrt(sum(x * x for x in v))</code>`,
        solution: R`import math

def length(v):
    # square root of the sum of squares
    return math.sqrt(sum(x * x for x in v))`,
        tests: [
          { name: 'the 3-4-5 triangle', check: R`r = length([3, 4]); assert close(r, 5, 1e-9), f"got {r}"` },
          { name: 'the drone is 5.66 from home', check: R`r = length([4, 4]); assert close(r, 5.657, 0.001), f"got {r}"` },
          { name: 'works in any dimension', check: R`r = length([1, 2, 2]); assert close(r, 3, 1e-9), f"got {r}, expected √(1 + 4 + 4) = 3"` },
        ],
      },
      {
        id: 'distance', title: 'Distance between two places',
        brief: R`<p>The distance between two points is the length of the arrow from one to the other. That arrow is \(q - p\): subtract matching entries.</p>
          \[ d(p, q) = |q - p| \]
          <p>Write <code>distance(p, q)</code>. Reuse <code>add</code>, <code>scale</code> and <code>length</code>: \(q - p = q + (-1) \times p\).</p>`,
        starter: R`def distance(p, q):
    # the length of q - p
    return 0`,
        hint: R`<code>return length(add(q, scale(-1, p)))</code>`,
        solution: R`def distance(p, q):
    # the length of q - p
    return length(add(q, scale(-1, p)))`,
        tests: [
          { name: 'from (−3, −1) to (2, 2)', check: R`r = distance([-3, -1], [2, 2]); assert close(r, 5.831, 0.001), f"got {r}, expected √(5² + 3²) = 5.831"` },
          { name: 'the distance to yourself is 0', check: R`assert distance([1, 2], [1, 2]) == 0, "a point is 0 away from itself"` },
          { name: 'same both ways', check: R`assert close(distance([0, 5], [3, 1]), distance([3, 1], [0, 5]), 1e-9), "distance(p, q) should equal distance(q, p)"` },
        ],
      },
      {
        id: 'dot', title: 'The dot product',
        brief: R`<p>Multiply matching entries and add them up. Two vectors in, one number out:</p>
          \[ u \cdot v = u_1 v_1 + u_2 v_2 + \dots + u_n v_n \]
          <p>It is positive when the arrows point the same way, zero at right angles, negative when they point apart. Write <code>dot(u, v)</code>.</p>`,
        starter: R`def dot(u, v):
    # sum of matching products
    return 0`,
        hint: R`<code>return sum(a * b for a, b in zip(u, v))</code>`,
        solution: R`def dot(u, v):
    # sum of matching products
    return sum(a * b for a, b in zip(u, v))`,
        tests: [
          { name: '(3, 1) · (2, 4) = 10', check: R`r = dot([3, 1], [2, 4]); assert r == 10, f"got {r}, expected 3 × 2 + 1 × 4"` },
          { name: 'at right angles it is 0', check: R`r = dot([1, 0], [0, 5]); assert r == 0, f"got {r}"` },
          { name: 'pointing apart it is negative', check: R`r = dot([3, 1], [-2, -1]); assert r < 0, f"got {r}"` },
        ],
      },
      {
        id: 'similarity', title: 'How similar are two tastes?',
        brief: R`<p>Three friends rate five kinds of film (action, comedy, drama, horror, romance) from 0 to 5. Whose taste is closest to Asha's?</p>
          <p>Compare the <em>direction</em> of their rating vectors, ignoring how generous each person is. That is the <strong>cosine similarity</strong>: 1 means the same direction, 0 unrelated.</p>
          \[ \text{similarity}(u, v) = \frac{u \cdot v}{|u| \times |v|} \]
          <p>Write <code>similarity(u, v)</code>.</p>`,
        starter: R`def similarity(u, v):
    # dot product divided by both lengths
    return 0

asha  = [5, 1, 4, 0, 2]
ben   = [4, 2, 5, 1, 1]
chloe = [0, 5, 1, 4, 5]
print("Asha and Ben:  ", round(similarity(asha, ben), 3))
print("Asha and Chloe:", round(similarity(asha, chloe), 3))`,
        hint: R`<code>return dot(u, v) / (length(u) * length(v))</code>`,
        solution: R`def similarity(u, v):
    # dot product divided by both lengths
    return dot(u, v) / (length(u) * length(v))

asha  = [5, 1, 4, 0, 2]
ben   = [4, 2, 5, 1, 1]
chloe = [0, 5, 1, 4, 5]
print("Asha and Ben:  ", round(similarity(asha, ben), 3))
print("Asha and Chloe:", round(similarity(asha, chloe), 3))`,
        tests: [
          { name: 'a vector is perfectly similar to itself', check: R`r = similarity([5, 1, 4], [5, 1, 4]); assert close(r, 1, 1e-9), f"got {r}"` },
          { name: 'doubling a vector keeps its direction', check: R`r = similarity([1, 2], [2, 4]); assert close(r, 1, 1e-9), f"got {r}"` },
          { name: 'Ben is much closer to Asha than Chloe is', check: R`a, b = similarity(asha, ben), similarity(asha, chloe); assert close(a, 0.946, 0.001) and a > b, f"Ben {a:.3f}, Chloe {b:.3f}"` },
        ],
      },
      {
        id: 'mat_vec', title: 'Turn a game character',
        brief: R`<p>A matrix is a grid of numbers, stored here as a list of rows. Multiplying a matrix by a vector gives one dot product per row:</p>
          \[ \begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} a x + b y \\ c x + d y \end{pmatrix} \]
          <p>The matrix <code>[[0, -1], [1, 0]]</code> turns anything a quarter turn to the left. Write <code>mat_vec(M, v)</code>.</p>`,
        starter: R`def mat_vec(M, v):
    # one dot product per row of M
    return []

turn_left = [[0, -1], [1, 0]]
facing = [1, 0]            # facing east
print("after one turn:", mat_vec(turn_left, facing))`,
        hint: R`<code>return [dot(row, v) for row in M]</code>`,
        solution: R`def mat_vec(M, v):
    # one dot product per row of M
    return [dot(row, v) for row in M]

turn_left = [[0, -1], [1, 0]]
facing = [1, 0]            # facing east
print("after one turn:", mat_vec(turn_left, facing))`,
        tests: [
          { name: 'east turns to north', check: R`r = mat_vec([[0, -1], [1, 0]], [1, 0]); assert list(r) == [0, 1], f"got {r}"` },
          { name: 'a general matrix', check: R`r = mat_vec([[1, 2], [3, 4]], [5, 6]); assert list(r) == [17, 39], f"got {r}, expected [1×5 + 2×6, 3×5 + 4×6]"` },
          { name: 'the identity matrix changes nothing', check: R`r = mat_vec([[1, 0], [0, 1]], [7, -2]); assert list(r) == [7, -2], f"got {r}"` },
        ],
      },
      {
        id: 'mat_mul', title: 'Two moves in one',
        brief: R`<p>Two matrices can be combined into one that does both moves. Entry (row \(i\), column \(j\)) of \(A \times B\) is the dot product of row \(i\) of \(A\) with column \(j\) of \(B\).</p>
          <p>Write <code>mat_mul(A, B)</code>. Column \(j\) of <code>B</code> is <code>[row[j] for row in B]</code>. Two left turns should make a U-turn.</p>`,
        starter: R`def mat_mul(A, B):
    # entry (i, j) = row i of A · column j of B
    return []`,
        hint: R`<code>cols = [[row[j] for row in B] for j in range(len(B[0]))]</code>, then <code>return [[dot(r, c) for c in cols] for r in A]</code>.`,
        solution: R`def mat_mul(A, B):
    # entry (i, j) = row i of A · column j of B
    cols = [[row[j] for row in B] for j in range(len(B[0]))]
    return [[dot(r, c) for c in cols] for r in A]`,
        tests: [
          { name: 'two left turns make a U-turn', check: R`r = mat_mul([[0, -1], [1, 0]], [[0, -1], [1, 0]]); assert [list(x) for x in r] == [[-1, 0], [0, -1]], f"got {r}"` },
          { name: 'a general product', check: R`r = mat_mul([[1, 2], [3, 4]], [[5, 6], [7, 8]]); assert [list(x) for x in r] == [[19, 22], [43, 50]], f"got {r}"` },
          { name: 'works for non-square shapes', check: R`r = mat_mul([[1, 2, 3]], [[1], [0], [2]]); assert [list(x) for x in r] == [[7]], f"got {r}"` },
        ],
      },
      {
        id: 'derivative', title: 'How steep is the hill?',
        brief: R`<p>The derivative is the slope of a curve at one point. Step a tiny amount \(h\) either side and measure the rise over the run:</p>
          \[ f'(x) \approx \frac{f(x + h) - f(x - h)}{2h} \]
          <p>Write <code>derivative(f, x)</code> with \(h = 0.00001\). Here <code>f</code> is any Python function of one number.</p>`,
        starter: R`def derivative(f, x, h=0.00001):
    # (f(x + h) - f(x - h)) / (2h)
    return 0`,
        hint: R`<code>return (f(x + h) - f(x - h)) / (2 * h)</code>`,
        solution: R`def derivative(f, x, h=0.00001):
    # (f(x + h) - f(x - h)) / (2h)
    return (f(x + h) - f(x - h)) / (2 * h)`,
        tests: [
          { name: 'x² ÷ 2 has slope 1.5 at x = 1.5', check: R`r = derivative(lambda x: x * x / 2, 1.5); assert close(r, 1.5, 1e-6), f"got {r}"` },
          { name: 'x³ has slope 12 at x = 2', check: R`r = derivative(lambda x: x ** 3, 2); assert close(r, 12, 1e-4), f"got {r}, expected 3 × 2² = 12"` },
          { name: 'a flat line has slope 0', check: R`r = derivative(lambda x: 7, 3); assert close(r, 0, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'probability', title: 'Roll the dice',
        brief: R`<p>When every outcome is equally likely, a chance is a count:</p>
          \[ P(\text{event}) = \frac{\text{outcomes where it happens}}{\text{all outcomes}} \]
          <p><code>rolls</code> lists all 36 ways two dice can land. Write <code>probability(outcomes, event)</code>, where <code>event</code> is a function that says True or False for one outcome.</p>`,
        starter: R`rolls = [(a, b) for a in range(1, 7) for b in range(1, 7)]

def probability(outcomes, event):
    # share of outcomes where event(outcome) is True
    return 0

print("P(sum is 7)   =", round(probability(rolls, lambda r: r[0] + r[1] == 7), 3))
print("P(double six) =", round(probability(rolls, lambda r: r == (6, 6)), 3))`,
        hint: R`<code>return sum(1 for o in outcomes if event(o)) / len(outcomes)</code>`,
        solution: R`rolls = [(a, b) for a in range(1, 7) for b in range(1, 7)]

def probability(outcomes, event):
    # share of outcomes where event(outcome) is True
    return sum(1 for o in outcomes if event(o)) / len(outcomes)

print("P(sum is 7)   =", round(probability(rolls, lambda r: r[0] + r[1] == 7), 3))
print("P(double six) =", round(probability(rolls, lambda r: r == (6, 6)), 3))`,
        tests: [
          { name: 'a seven is 6 in 36', check: R`r = probability(rolls, lambda r: r[0] + r[1] == 7); assert close(r, 6 / 36, 1e-9), f"got {r}"` },
          { name: 'a double six is 1 in 36', check: R`r = probability(rolls, lambda r: r == (6, 6)); assert close(r, 1 / 36, 1e-9), f"got {r}"` },
          { name: 'something always happens', check: R`r = probability(rolls, lambda r: True); assert r == 1, f"got {r}"` },
        ],
      },
      {
        id: 'conditional', title: 'Chances that change with news',
        brief: R`<p>You learn the first die shows a 6. How likely is a total above 9 now? Keep only the outcomes that match the news, then count again:</p>
          \[ P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)} \]
          <p>Read \(P(A \mid B)\) as "the chance of A, given B". Write <code>conditional(outcomes, a, b)</code>. This is the idea behind naive Bayes.</p>`,
        starter: R`def conditional(outcomes, a, b):
    # P(a and b) / P(b)
    return 0

above_nine = lambda r: r[0] + r[1] > 9
first_is_six = lambda r: r[0] == 6
print("before the news:", round(probability(rolls, above_nine), 3))
print("after the news: ", round(conditional(rolls, above_nine, first_is_six), 3))`,
        hint: R`<code>return probability(outcomes, lambda o: a(o) and b(o)) / probability(outcomes, b)</code>`,
        solution: R`def conditional(outcomes, a, b):
    # P(a and b) / P(b)
    return probability(outcomes, lambda o: a(o) and b(o)) / probability(outcomes, b)

above_nine = lambda r: r[0] + r[1] > 9
first_is_six = lambda r: r[0] == 6
print("before the news:", round(probability(rolls, above_nine), 3))
print("after the news: ", round(conditional(rolls, above_nine, first_is_six), 3))`,
        tests: [
          { name: 'a total above 9, given a first 6, is 1/2', check: R`r = conditional(rolls, above_nine, first_is_six); assert close(r, 0.5, 1e-9), f"got {r}, expected 3/36 ÷ 6/36"` },
          { name: 'news can lower chances too', check: R`r = conditional(rolls, above_nine, lambda o: o[0] == 1); assert r == 0, f"got {r}. With a first 1, the most you can reach is 7"` },
        ],
      },
      {
        id: 'descend', title: 'Roll downhill',
        brief: R`<p>Put it together. To find the bottom of a valley, stand anywhere, feel the slope with <code>derivative</code>, and step against it. Repeat:</p>
          \[ x \leftarrow x - \eta \times f'(x) \]
          <p>Write <code>descend(f, x, lr, steps)</code> and use it to find the lowest point of \(f(x) = (x - 3)^2 + 1\). This loop is the heart of every lesson that follows.</p>`,
        starter: R`def descend(f, x, lr, steps):
    # step against the slope, again and again
    return x

valley = lambda x: (x - 3) ** 2 + 1
bottom = descend(valley, 0, 0.1, 100)
print("the valley bottoms out at x =", round(bottom, 3), "where f =", round(valley(bottom), 3))`,
        hint: R`<code>for _ in range(steps):</code> then, indented, <code>x = x - lr * derivative(f, x)</code>.`,
        solution: R`def descend(f, x, lr, steps):
    # step against the slope, again and again
    for _ in range(steps):
        x = x - lr * derivative(f, x)
    return x

valley = lambda x: (x - 3) ** 2 + 1
bottom = descend(valley, 0, 0.1, 100)
print("the valley bottoms out at x =", round(bottom, 3), "where f =", round(valley(bottom), 3))`,
        tests: [
          { name: 'finds the bottom at x = 3', check: R`r = descend(lambda x: (x - 3) ** 2 + 1, 0, 0.1, 100); assert close(r, 3, 1e-3), f"got {r}"` },
          { name: 'one step from 0 moves to 0.6', check: R`r = descend(lambda x: (x - 3) ** 2 + 1, 0, 0.1, 1); assert close(r, 0.6, 1e-4), f"got {r}, expected 0 − 0.1 × (−6)"` },
          { name: 'zero steps stays put', check: R`r = descend(lambda x: x * x, 5, 0.1, 0); assert r == 5, f"got {r}"` },
        ],
      },
      {
        id: 'numpy', title: 'Check with numpy',
        brief: R`<p>In practice these tools come from <strong>numpy</strong>, which does the same maths on huge arrays very fast. Compare a few of yours with it:</p>
          <ul><li><code>np.linalg.norm(v)</code> is <code>length(v)</code></li><li><code>np.dot(u, v)</code> is <code>dot(u, v)</code></li><li><code>A @ B</code> multiplies numpy matrices, like <code>mat_mul</code></li></ul>
          <p>Fill in the three numpy results.</p>${NOTE}`,
        starter: R`import numpy as np

u, v = [3, 1], [2, 4]
A, B = [[1, 2], [3, 4]], [[5, 6], [7, 8]]

np_length = None    # replace: np.linalg.norm of u
np_dot = None       # replace: np.dot of u and v
np_product = None   # replace: np.array(A) @ np.array(B)

print("length:", length(u), "| numpy:", np_length)
print("dot:   ", dot(u, v), "| numpy:", np_dot)
print("A × B: ", mat_mul(A, B), "| numpy:", None if np_product is None else np_product.tolist())`,
        hint: R`<code>np_length = np.linalg.norm(u)</code>, <code>np_dot = np.dot(u, v)</code>, <code>np_product = np.array(A) @ np.array(B)</code>.`,
        solution: R`import numpy as np

u, v = [3, 1], [2, 4]
A, B = [[1, 2], [3, 4]], [[5, 6], [7, 8]]

np_length = np.linalg.norm(u)
np_dot = np.dot(u, v)
np_product = np.array(A) @ np.array(B)

print("length:", length(u), "| numpy:", np_length)
print("dot:   ", dot(u, v), "| numpy:", np_dot)
print("A × B: ", mat_mul(A, B), "| numpy:", None if np_product is None else np_product.tolist())`,
        tests: [
          { name: 'same length', check: R`assert np_length is not None and close(float(np_length), length(u), 1e-9), f"numpy gives {np_length}"` },
          { name: 'same dot product', check: R`assert np_dot is not None and float(np_dot) == dot(u, v), f"numpy gives {np_dot}"` },
          { name: 'same matrix product', check: R`assert np_product is not None and np_product.tolist() == mat_mul(A, B), f"numpy gives {np_product}"` },
        ],
      },
    ],
  };
})();
