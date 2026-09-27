// Coding lab for the Naive Bayes lesson.
// Each step: id, title, brief (HTML, math in \( \) and \[ \]), starter, hint, solution, tests.
// Tests run after all earlier steps' code. close(a, b, tol=0.01) is provided.
(() => {
  const R = String.raw;
  window.LABS = window.LABS || {};
  window.LABS['naive-bayes'] = {
    file: 'naive_bayes.py',
    title: 'Write a naive Bayes spam filter from scratch',
    intro: R`Twelve small steps: split messages into words, count them, turn counts into chances with add-one smoothing, and combine the clues with Bayes' rule. Plain Python, with only the built-in <code>math</code> module.`,
    doneTitle: 'You wrote a naive Bayes spam filter from scratch.',
    doneText: 'Every line below is yours: the prior, the word counts, smoothing, scores, Bayes’ rule and logarithms. The lesson is marked as done.',
    finalMessage: 'All tests pass. Your spam filter works.',
    steps: [
      {
        id: 'data', title: 'Store the messages',
        brief: R`<p>The seven sorted messages from the film, as <code>(text, label)</code> pairs, with the label <code>"spam"</code> or <code>"ham"</code> (normal mail). The first three are spam.</p>`,
        starter: R`messages = [
    ("win money now", "spam"),
    ("free money", "spam"),
    ("win free prize", "spam"),
    # add the four normal ("ham") messages:
    # meeting at noon / lunch money / free lunch at noon / see you now
]`,
        hint: R`Add <code>("meeting at noon", "ham")</code> and the other three the same way.`,
        solution: R`messages = [
    ("win money now", "spam"),
    ("free money", "spam"),
    ("win free prize", "spam"),
    ("meeting at noon", "ham"),
    ("lunch money", "ham"),
    ("free lunch at noon", "ham"),
    ("see you now", "ham"),
]`,
        tests: [
          { name: 'seven messages', check: R`assert len(messages) == 7, f"got {len(messages)} messages"` },
          { name: 'three spam, four ham', check: R`labs = [l for _, l in messages]; assert labs.count("spam") == 3 and labs.count("ham") == 4, f"labels are {labs}"` },
          { name: 'the ham messages are right', check: R`assert [t for t, l in messages if l == "ham"] == ["meeting at noon", "lunch money", "free lunch at noon", "see you now"], "check the text of the ham messages"` },
        ],
      },
      {
        id: 'words', title: 'Split into words',
        brief: R`<p>Write <code>words(text)</code> that lowercases the text and splits it on spaces, so <code>"Win Money"</code> becomes <code>["win", "money"]</code>.</p>`,
        starter: R`def words(text):
    # lowercase, then split on spaces
    return []`,
        hint: R`<code>return text.lower().split()</code>`,
        solution: R`def words(text):
    # lowercase, then split on spaces
    return text.lower().split()`,
        tests: [
          { name: 'splits and lowercases', check: R`r = words("Win FREE money"); assert r == ["win", "free", "money"], f"got {r}"` },
        ],
      },
      {
        id: 'priors', title: 'The prior',
        brief: R`<p>How common is each class before reading any words?</p>
          \[ P(\text{spam}) = \frac{\text{spam messages}}{\text{all messages}} \]
          <p>Write <code>priors(messages)</code> returning a dictionary such as <code>{"spam": 0.43, "ham": 0.57}</code>.</p>`,
        starter: R`def priors(messages):
    # {label: share of messages with that label}
    return {}`,
        hint: R`Count labels in a dictionary with <code>counts[l] = counts.get(l, 0) + 1</code>, then divide each count by <code>len(messages)</code>.`,
        solution: R`def priors(messages):
    # {label: share of messages with that label}
    counts = {}
    for _, label in messages:
        counts[label] = counts.get(label, 0) + 1
    return {label: c / len(messages) for label, c in counts.items()}`,
        tests: [
          { name: 'P(spam) is 3/7', check: R`r = priors(messages); assert close(r["spam"], 3 / 7, 1e-9), f"got {r}"` },
          { name: 'P(ham) is 4/7', check: R`r = priors(messages); assert close(r["ham"], 4 / 7, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'counts', title: 'Count the words',
        brief: R`<p>For each class, count how often every word appears. Write <code>word_counts(messages)</code> returning a dictionary of dictionaries: <code>counts["spam"]["money"]</code> should be 2.</p>`,
        starter: R`def word_counts(messages):
    # {label: {word: count}}
    counts = {}

    return counts`,
        hint: R`For each message, <code>counts.setdefault(label, {})</code>, then for each word in <code>words(text)</code> add one to <code>counts[label][w]</code> using <code>.get(w, 0) + 1</code>.`,
        solution: R`def word_counts(messages):
    # {label: {word: count}}
    counts = {}
    for text, label in messages:
        counts.setdefault(label, {})
        for w in words(text):
            counts[label][w] = counts[label].get(w, 0) + 1
    return counts`,
        tests: [
          { name: 'money appears twice in spam', check: R`c = word_counts(messages); assert c["spam"]["money"] == 2, f"got {c['spam'].get('money')}"` },
          { name: 'lunch appears twice in ham', check: R`c = word_counts(messages); assert c["ham"]["lunch"] == 2, f"got {c['ham'].get('lunch')}"` },
          { name: 'lunch never appears in spam', check: R`c = word_counts(messages); assert c["spam"].get("lunch", 0) == 0, "lunch should not be counted for spam"` },
        ],
      },
      {
        id: 'totals', title: 'Words per class',
        brief: R`<p>Write <code>total_words(counts, label)</code>: how many words (counting repeats) that class has in total. Spam has 8, ham has 12.</p>`,
        starter: R`def total_words(counts, label):
    # sum of all word counts for this label
    return 0`,
        hint: R`<code>return sum(counts[label].values())</code>`,
        solution: R`def total_words(counts, label):
    # sum of all word counts for this label
    return sum(counts[label].values())`,
        tests: [
          { name: 'spam has 8 words', check: R`r = total_words(word_counts(messages), "spam"); assert r == 8, f"got {r}"` },
          { name: 'ham has 12 words', check: R`r = total_words(word_counts(messages), "ham"); assert r == 12, f"got {r}"` },
        ],
      },
      {
        id: 'vocab', title: 'The vocabulary',
        brief: R`<p>Smoothing needs the number of <em>different</em> words we have seen. Write <code>vocabulary(messages)</code> returning the set of all distinct words. There are 11.</p>`,
        starter: R`def vocabulary(messages):
    # the set of all distinct words
    return set()`,
        hint: R`<code>return {w for text, _ in messages for w in words(text)}</code>`,
        solution: R`def vocabulary(messages):
    # the set of all distinct words
    return {w for text, _ in messages for w in words(text)}`,
        tests: [
          { name: '11 different words', check: R`r = vocabulary(messages); assert len(r) == 11, f"got {len(r)}: {sorted(r)}"` },
          { name: 'includes win and meeting', check: R`r = vocabulary(messages); assert "win" in r and "meeting" in r, "missing words"` },
        ],
      },
      {
        id: 'likelihood', title: 'Chance of a word, with smoothing',
        brief: R`<p>With add-one smoothing, no word is ever impossible:</p>
          \[ P(\text{word} \mid \text{class}) = \frac{\text{count of word in class} + 1}{\text{words in class} + V} \]
          <p>Here \(V\) is the vocabulary size. Write <code>likelihood(word, label, counts, V)</code>.</p>`,
        starter: R`def likelihood(word, label, counts, V):
    # (count + 1) / (words in class + V)
    return 0`,
        hint: R`<code>return (counts[label].get(word, 0) + 1) / (total_words(counts, label) + V)</code>`,
        solution: R`def likelihood(word, label, counts, V):
    # (count + 1) / (words in class + V)
    return (counts[label].get(word, 0) + 1) / (total_words(counts, label) + V)`,
        tests: [
          { name: 'P(money | spam) = 3/19', check: R`r = likelihood("money", "spam", word_counts(messages), 11); assert close(r, 3 / 19, 1e-9), f"got {r}, expected (2 + 1) / (8 + 11)"` },
          { name: 'an unseen word is not zero', check: R`r = likelihood("lunch", "spam", word_counts(messages), 11); assert close(r, 1 / 19, 1e-9), f"got {r}, expected (0 + 1) / (8 + 11)"` },
          { name: 'P(win | ham) = 1/23', check: R`r = likelihood("win", "ham", word_counts(messages), 11); assert close(r, 1 / 23, 1e-9), f"got {r}"` },
        ],
      },
      {
        id: 'score', title: 'Score a message',
        brief: R`<p>The naive assumption: multiply the prior by the chance of each word, as if the words were independent:</p>
          \[ \text{score}(\text{class}) = P(\text{class}) \times P(\text{word}_1 \mid \text{class}) \times P(\text{word}_2 \mid \text{class}) \times \dots \]
          <p>Write <code>score(text, label, prior, counts, V)</code>, where <code>prior</code> is the dictionary from <code>priors</code>.</p>`,
        starter: R`def score(text, label, prior, counts, V):
    # prior times the chance of every word
    s = prior[label]

    return s`,
        hint: R`<code>for w in words(text):</code> then <code>s *= likelihood(w, label, counts, V)</code>.`,
        solution: R`def score(text, label, prior, counts, V):
    # prior times the chance of every word
    s = prior[label]
    for w in words(text):
        s *= likelihood(w, label, counts, V)
    return s`,
        tests: [
          { name: 'spam score of "free money now"', check: R`r = score("free money now", "spam", priors(messages), word_counts(messages), 11); assert close(r, 3/7 * 3/19 * 3/19 * 2/19, 1e-12), f"got {r}, expected 3/7 × 3/19 × 3/19 × 2/19 = 0.0011247"` },
          { name: 'ham score of "free money now"', check: R`r = score("free money now", "ham", priors(messages), word_counts(messages), 11); assert close(r, 4/7 * 2/23 * 2/23 * 2/23, 1e-12), f"got {r}, expected 0.0003757"` },
        ],
      },
      {
        id: 'posterior', title: 'Bayes’ rule',
        brief: R`<p>Turn the two scores into a probability:</p>
          \[ P(\text{spam} \mid \text{message}) = \frac{\text{score(spam)}}{\text{score(spam)} + \text{score(ham)}} \]
          <p>Write <code>chance_of_spam(text, prior, counts, V)</code>.</p>`,
        starter: R`def chance_of_spam(text, prior, counts, V):
    # score(spam) / (score(spam) + score(ham))
    return 0`,
        hint: R`Compute <code>s = score(text, "spam", prior, counts, V)</code> and <code>h</code> the same for <code>"ham"</code>, then <code>return s / (s + h)</code>.`,
        solution: R`def chance_of_spam(text, prior, counts, V):
    # score(spam) / (score(spam) + score(ham))
    s = score(text, "spam", prior, counts, V)
    h = score(text, "ham", prior, counts, V)
    return s / (s + h)`,
        tests: [
          { name: '"free money now" is 75% spam', check: R`r = chance_of_spam("free money now", priors(messages), word_counts(messages), 11); assert close(r, 0.7496, 0.001), f"got {r:.4f}, expected 0.7496"` },
          { name: '"win lunch" is a near coin toss', check: R`r = chance_of_spam("win lunch", priors(messages), word_counts(messages), 11); assert close(r, 0.5236, 0.001), f"got {r:.4f}, expected 0.5236"` },
        ],
      },
      {
        id: 'predict', title: 'Pick a label',
        brief: R`<p>Write <code>classify(text, prior, counts, V)</code> that returns <code>"spam"</code> when the chance of spam is above one half, and <code>"ham"</code> otherwise.</p>`,
        starter: R`def classify(text, prior, counts, V):
    # "spam" if chance_of_spam > 0.5, else "ham"
    return None`,
        hint: R`<code>return "spam" if chance_of_spam(text, prior, counts, V) > 0.5 else "ham"</code>`,
        solution: R`def classify(text, prior, counts, V):
    # "spam" if chance_of_spam > 0.5, else "ham"
    return "spam" if chance_of_spam(text, prior, counts, V) > 0.5 else "ham"`,
        tests: [
          { name: '"win free prize" is spam', check: R`r = classify("win free prize", priors(messages), word_counts(messages), 11); assert r == "spam", f"got {r!r}"` },
          { name: '"see you at noon" is ham', check: R`r = classify("see you at noon", priors(messages), word_counts(messages), 11); assert r == "ham", f"got {r!r}"` },
        ],
      },
      {
        id: 'logs', title: 'Long messages: use logarithms',
        brief: R`<p>Multiplying hundreds of small numbers underflows to exactly 0 on a computer. Logarithms turn products into sums, which stay safe:</p>
          \[ \log(\text{score}) = \log P(\text{class}) + \log P(\text{word}_1 \mid \text{class}) + \dots \]
          <p>Write <code>log_score(text, label, prior, counts, V)</code> using <code>math.log</code>. The larger log score still wins.</p>`,
        starter: R`import math

def log_score(text, label, prior, counts, V):
    # log(prior) + sum of log(likelihood) for every word
    return 0`,
        hint: R`Start with <code>s = math.log(prior[label])</code>, then <code>s += math.log(likelihood(w, label, counts, V))</code> for each word.`,
        solution: R`import math

def log_score(text, label, prior, counts, V):
    # log(prior) + sum of log(likelihood) for every word
    s = math.log(prior[label])
    for w in words(text):
        s += math.log(likelihood(w, label, counts, V))
    return s`,
        tests: [
          { name: 'matches the log of the score', check: R`p, c = priors(messages), word_counts(messages); r = log_score("free money now", "spam", p, c, 11); assert close(r, math.log(score("free money now", "spam", p, c, 11)), 1e-9), f"got {r}"` },
          { name: 'a 500-word message does not collapse to zero', check: R`p = priors(messages); cc = word_counts(messages); long = " ".join(["free money"] * 250); assert score(long, "spam", p, cc, 11) == 0.0 and log_score(long, "spam", p, cc, 11) > -1e6 and log_score(long, "spam", p, cc, 11) > log_score(long, "ham", p, cc, 11), "log scores should stay finite and still rank spam above ham"` },
        ],
      },
      {
        id: 'use', title: 'Put it to work',
        brief: R`<p>Build the model once from <code>messages</code>, then classify a batch of new messages. Replace the three placeholder lines: the prior, the word counts, and the vocabulary size.</p>`,
        starter: R`inbox = ["free prize now", "lunch at noon", "win money", "see you at the meeting", "free lunch"]

prior = {}      # replace: the priors of messages
counts = {}     # replace: the word counts of messages
V = 0           # replace: the size of the vocabulary

for text in inbox:
    if prior and counts and V:
        print(f"{text:<25} {classify(text, prior, counts, V):<5} {chance_of_spam(text, prior, counts, V):.0%} spam")`,
        hint: R`<code>prior = priors(messages)</code>, <code>counts = word_counts(messages)</code>, <code>V = len(vocabulary(messages))</code>. Words never seen before, like "the", simply get the smallest smoothed chance in both classes.`,
        solution: R`inbox = ["free prize now", "lunch at noon", "win money", "see you at the meeting", "free lunch"]

prior = priors(messages)
counts = word_counts(messages)
V = len(vocabulary(messages))

for text in inbox:
    if prior and counts and V:
        print(f"{text:<25} {classify(text, prior, counts, V):<5} {chance_of_spam(text, prior, counts, V):.0%} spam")`,
        tests: [
          { name: 'the model is built from the messages', check: R`assert prior == priors(messages) and counts == word_counts(messages) and V == 11, f"V is {V}"` },
          { name: 'the inbox is sorted sensibly', check: R`r = [classify(t, prior, counts, V) for t in inbox]; assert r == ["spam", "ham", "spam", "ham", "ham"], f"got {r}"` },
        ],
      },
    ],
  };
})();
