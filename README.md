# SOT Playbook

A static playbook site for stream operators. It's plain HTML, CSS and JavaScript, with no build step, hosted on GitHub Pages.

- **Edit content:** everything lives in `data/*.json`. See [`data/README.md`](data/README.md).
- **Step-by-step guide:** [`HOW-TO-UPDATE.md`](HOW-TO-UPDATE.md)
- **Preview locally:** double-click `preview.bat` (needs Node.js), then open http://localhost:8080
- **Check data before publishing:** `node tools/check.js`

```
index.html        the page (top bar, footer, search window)
css/style.css     all styling; colours are at the top
js/app.js         draws pages from the data files: search, filters, cards, copy buttons, theme
data/             all content
assets/           favicon
tools/            preview server and data checker
robots.txt        blocks search engines
```
