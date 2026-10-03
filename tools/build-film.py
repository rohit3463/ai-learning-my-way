# Wrap a film script that uses films/film-kit.js in the shared film page.
# usage: python3 tools/build-film.py <slug> "<Title>" "<kicker>" "<byline>" "<aria label>" <seconds> <script.js>
import sys
slug, title, kicker, by, aria, dur, script = sys.argv[1:8]
src = open('films/support-vector-machines.html').read()
head = src[:src.index('<script>\n(() => {')]
for a, b in [('<title>The Widest Street</title>', f'<title>{title}</title>'),
             ('A short film about support vector machines', kicker),
             ('<h1>The Widest Street</h1>', f'<h1>{title}</h1>'),
             ('two kinds of points, one border, and all the room between them', by),
             ('aria-label="Animated film about support vector machines: margins, the hinge loss and the widest street"', f'aria-label="{aria}"')]:
    assert head.count(a) == 1, a
    head = head.replace(a, b)
d = int(dur)
head = head.replace('max="142"', f'max="{d}"').replace('0:00 / 2:22', f'0:00 / {d // 60}:{d % 60:02d}')
open(f'films/{slug}.html', 'w').write(head + '<script src="film-kit.js?v=1"></script>\n<script>\n' + open(script).read() + '\n</script>\n</body>\n</html>\n')
print('wrote films/' + slug + '.html')
