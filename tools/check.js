/* Check the data files before you publish.
   Run:  node tools/check.js       (preview.bat runs it for you)

   It looks for:
   - typos that would break a data file (missing commas, quotes)
   - missing titles, terms or bad dates
   - privacy problems: email addresses, phone numbers, or links that
     are not Google Drive / Docs / Slides / YouTube
   It only reads files; it never changes anything. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const ALLOWED_HOSTS = /^https:\/\/(docs\.google\.com|drive\.google\.com|www\.youtube\.com|youtube\.com|youtu\.be)\//i;

let problems = 0, warnings = 0;
const bad = (msg) => { problems++; console.log('  ✖ ' + msg); };
const warn = (msg) => { warnings++; console.log('  ! ' + msg); };

function readJson(file) {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8');
  try { return { json: JSON.parse(text), text }; }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const line = m ? text.slice(0, +m[1]).split('\n').length : '?';
    bad(`${file}: typo near line ${line}. Usually a missing comma, an extra comma before ] or }, or a missing " quote.`);
    return null;
  }
}

// Privacy scan of the raw text of every file
function scanText(file, text) {
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    const where = `${file} line ${i + 1}`;
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(ln)) bad(`${where}: looks like an email address. Remove it (the site is public).`);
    if (/\+?\d[\d\s().-]{8,}\d/.test(ln) && !/tk|token|\d{4}-\d{2}-\d{2}/i.test(ln)) warn(`${where}: looks like a phone number. Check it.`);
    (ln.match(/https?:\/\/[^\s"']+/g) || []).forEach((url) => {
      if (/REPLACE|PASTE|XXXX/i.test(url)) warn(`${where}: placeholder link still in place (fine for now).`);
      else if (!ALLOWED_HOSTS.test(url)) bad(`${where}: link to ${url}. Only Google Drive/Docs/Slides/YouTube links are allowed.`);
    });
    if (/slack\.com|notion\.so|drive\.google\.com\/drive\/folders/i.test(ln)) bad(`${where}: internal link (Slack, Notion or a Drive folder). Remove it.`);
  });
}

console.log('Checking data files…\n');
let site;
const siteRead = readJson('site.json');
if (siteRead) { site = siteRead.json; scanText('site.json', siteRead.text); }
const sections = (site && site.sections) || [];
if (site && !sections.length) bad('site.json: "sections" list is empty.');

sections.forEach((sec) => {
  if (!sec.id || !sec.file) { bad(`site.json: a section is missing "id" or "file".`); return; }
  if (!fs.existsSync(path.join(DATA, sec.file))) { bad(`site.json: section "${sec.id}" points to data/${sec.file}, which doesn't exist.`); return; }
  const r = readJson(sec.file);
  if (!r) return;
  scanText(sec.file, r.text);
  if (!Array.isArray(r.json)) { bad(`${sec.file}: must start with [ and end with ] (a list of entries).`); return; }
  r.json.forEach((it, i) => {
    const label = `${sec.file} entry ${i + 1}`;
    if (sec.type === 'glossary') {
      if (!it.term) bad(`${label}: missing "term".`);
      if (!it.definition) warn(`${label} (${it.term || '?'}): missing "definition".`);
    } else if (!it.title) bad(`${label}: missing "title".`);
    if (sec.type === 'strategies') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date || '')) bad(`${label} (${it.title || '?'}): "date" must look like 2026-11-05.`);
    }
    if (it.draft) warn(`${label} (${it.title || it.term}): marked as draft.`);
  });
  console.log(`  ✓ ${sec.file}: ${r.json.length} entries`);
});

console.log(`\n${problems} problem(s), ${warnings} note(s).`);
if (problems) { console.log('Fix the problems above before publishing.'); process.exitCode = 1; }
else console.log('All good. Safe to publish.');
