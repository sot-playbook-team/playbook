# How to update the SOT Playbook

You only ever edit files in the `data` folder. Full field-by-field examples are in [`data/README.md`](data/README.md).

There are two ways to make a change. **A** needs nothing installed and is the easiest.

---

## A. Edit straight on GitHub (no tools needed)

1. Open the repository on github.com and click the `data` folder.
2. Click the file you want, for example `strategies.json`.
3. Click the **pencil icon** (Edit this file) at the top right of the file.
4. Make your change (see the recipes below).
5. Click **Commit changes…** (green button), write a short note like "Add Belt Bra strategy", and click **Commit changes**.
6. Wait about 1 minute, then refresh the live site. If the change doesn't appear, do a hard refresh with **Ctrl+F5**.

If the site shows a yellow box saying a file has a typo, open that file again. Fix the line it names (usually a missing comma or quote) and commit again.

## B. Edit on your computer, then push (only if Git is installed)

1. Edit the files in `D:\SOT Playbook\data` with any text editor (Notepad works; VS Code is nicer and highlights typos).
2. Double-click **`preview.bat`**. It checks the files for typos and privacy problems, then opens the site at http://localhost:8080.
3. When it looks right, publish:
   ```
   cd "D:\SOT Playbook"
   git add .
   git commit -m "Describe your change"
   git push
   ```
4. The live site updates in about 1 minute.

---

## Recipe 1: add a strategy

In `data/strategies.json`, copy an existing block from `{` to `},` and paste it right after the first `[` at the top. Then change:

- `title`: the strategy name
- `date`: today, as `YYYY-MM-DD`. This gives it the **NEW** badge for 14 days and puts it in the Home banner.
- `tags`: reuse existing ones where possible: `"costume"`, `"tease"`, `"slow room"`, `"high energy"`
- `summary`, `howTo`, `goalLadder`, `prompts`, `tips`
- `embed`: the Slides or video link (see Recipe 3), or `""` for none

Make sure there's a comma after your block's closing `}`, because another block follows it.

## Recipe 2: add a glossary term

In `data/glossary.json`, add one line anywhere (the site sorts A–Z):

```json
{ "term": "CT", "full": "Chat team", "definition": "The team that handles fan messaging." },
```

Remove `"draft": true` from a term once its wording is confirmed.

## Recipe 3: embed a Google Slides deck (access restricted to the company)

1. Open the deck in Google Slides.
2. Click **Share** and set **General access** to **your company** (anyone in the company with the link). Don't use "Anyone with the link".
3. Go to **File → Share → Publish to web → Embed**.
4. Under **Published content & settings**, make sure **Restrict access to the following: [your company]** is ticked. Then click **Publish**.
5. Copy the deck's link from the browser address bar, or the `src="…"` link from the embed code. Both work.
6. Paste it into the card's `"embed"` field:
   ```json
   "embed": "https://docs.google.com/presentation/d/1AbCdEf.../edit"
   ```

Outsiders who open the site see a sign-in box or a "Request access" message instead of the deck. Every embed also has an **Open in Google Slides ↗** button underneath.

**Videos:** upload to Google Drive, share with the company only, and paste the Drive link into `"embed"`.
**Images:** upload to Drive, share with the company only, and paste the link into `"image"`.

## Recipe 4: rename the site

In `data/site.json`, change `"name": "SOT Playbook"` to the new name. The logo, the home banner and the browser tab all update.
The footer text and `[CREDITS]` are in the same file.

---

## Before every publish: privacy check

The site's text is public on the internet, even though search engines are told to ignore it.

- No model names (real or stage), photos, usernames, earnings or coworker names.
- No internal links (Slack, the Hub, Drive folders).
- Keep wording neutral. Put anything sensitive inside the restricted Slides deck, not in the data files.
- `preview.bat` (or `node tools/check.js`) flags emails, phone numbers and non-Google links automatically.
