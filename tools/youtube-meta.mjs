// Write a ready-to-paste YouTube title and description for each rendered film.
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2];
const SITE = 'https://rohit3463.github.io/ai-learning-my-way/';
const lessons = JSON.parse(fs.readFileSync(path.join(process.argv[3], 'content/lessons.json'), 'utf8')).lessons;
lessons.forEach((l, i) => {
  const ch = path.join(OUT, `${l.slug}.chapters.txt`);
  if (!fs.existsSync(ch)) return;
  const title = `${l.film.title} | ${l.title}, animated (Lesson ${i}) | Learning AI My Way`;
  const desc = [
    `${l.summary}`,
    '',
    `An animated lesson from Learning AI My Way: see the idea move, then derive the math, then write the code yourself.`,
    '',
    `▶ Full lesson with the math and a hands-on coding lab: ${SITE}lesson.html?l=${l.slug}`,
    `▶ All lessons: ${SITE}`,
    '',
    'Chapters',
    fs.readFileSync(ch, 'utf8').trim(),
    '',
    `#MachineLearning #${l.title.replace(/[^A-Za-z]/g, '')} #MathAnimation #LearnAI`,
  ].join('\n');
  fs.writeFileSync(path.join(OUT, `${l.slug}.youtube.txt`), `TITLE\n${title}\n\nDESCRIPTION\n${desc}\n`);
  console.log('wrote', l.slug, title.length, 'chars in title');
});
