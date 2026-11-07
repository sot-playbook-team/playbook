# How to edit the content

All the text on the site lives in this `data` folder. You never need to touch the HTML.

| File | Section on the site |
|---|---|
| `site.json` | Site name, tagline, footer, credits, and the list of sections |
| `strategies.json` | New Strategies (and the 3 newest on Home) |
| `model.json` | Model |
| `goals.json` | Goals |
| `frames.json` | Frames & Positions |
| `fillers.json` | Fillers |
| `user.json` | User |
| `support.json` | Support |
| `glossary.json` | Encyclopedia (A–Z) |

---

## The 4 rules of these files (JSON)

1. Text goes inside **straight double quotes**: `"like this"`. Not `'single'` and not “curly” quotes.
2. Entries are separated by a **comma**. The **last** entry has **no** comma after it.
3. Every `{` needs a matching `}`, and every `[` a matching `]`.
4. To use a `"` inside text, write `\"`. Example: `"Say \"hello\" first"`.

If you break a rule, the site shows a yellow box naming the file and the line. Nothing is lost; fix the typo and refresh.
You can also run `node tools/check.js` (or double-click `preview.bat`) to check every file.

---

## Add a new strategy

Open `strategies.json`. Copy one whole block from `{` to `},`, paste it at the **top** of the list (right after the first `[`), and change the text.

```json
[
  {
    "title": "Backless Dress",
    "date": "2026-11-20",
    "tags": ["tease", "slow room"],
    "summary": "One sentence that shows on the card.",
    "details": ["Optional longer paragraph."],
    "howTo": [
      "Step one.",
      "Step two."
    ],
    "goalLadder": [
      "25 tk · Warm-up goal",
      "300 tk · Main goal",
      "150 tk · Step-down goal"
    ],
    "prompts": [
      "+ A line the model can say"
    ],
    "tips": ["Optional tip."],
    "embed": "https://docs.google.com/presentation/d/YOUR_DECK_ID/edit"
  },
  { ...the older strategies stay below... }
]
```

- **date**: always `YYYY-MM-DD`. Strategies dated in the last 14 days get a **NEW** badge automatically. Home shows the 3 newest.
- **tags**: lower-case words. Each tag becomes a filter button. Reuse existing tags where you can (`costume`, `tease`, `slow room`, `high energy`).
- **embed**: paste the Google Slides, Drive video or YouTube link. Leave it `""` for none.
- You can leave out any line you don't need, except `title` and `date`.

## Add a card to any other section

Same idea, fewer fields. Only `title` is required.

```json
{
  "title": "Thumbnail shot",
  "summary": "Shows on the card before it's opened.",
  "steps": ["Step one.", "Step two."],
  "prompts": ["+ A line with a Copy button"],
  "goalLadder": ["A list with a Copy all button"],
  "tips": ["Extra tip."],
  "image": "https://drive.google.com/file/d/YOUR_IMAGE_ID/view",
  "embed": "",
  "draft": true
}
```

Optional extras: `"details"` (paragraphs), `"tags"`, and `"stepsTitle"`, `"ladderTitle"`, `"promptsTitle"`, `"tipsTitle"` to rename the small headings.
`"draft": true` shows a **Draft** chip. Delete that line when the wording is approved.

**Photo grids (Frames):** put a Drive *folder* link in `"embed"`, e.g. `"embed": "https://drive.google.com/drive/folders/FOLDER_ID"`.
The card shows every photo in that folder. To add photos later, just drop them into the folder in Drive; no site edit needed.
The same works for `"screenshots"` on Tools cards: a folder link there shows a **Show screenshots** button.

To add an image with a description for screen readers, use: `"image": { "src": "https://drive.google.com/file/d/ID/view", "alt": "What the picture shows", "caption": "Optional caption" }`.

## Add a glossary term

Open `glossary.json` and add a line anywhere. The site sorts A–Z for you.

```json
{ "term": "EOS", "full": "End of Stream report", "definition": "The report filed after each stream." },
```

`full` is optional (what the letters stand for).

## Rename the site

In `site.json`, change `"name": "SOT Playbook"`. It updates the logo, the home banner and the browser tab.

## Sections (`site.json`)

Each section has: `id` (used in the web address, so **don't change it** once people have links), `file`, `label` (full name),
`nav` (short name in the top bar), `banner` (the big spaced-letter title) and `intro`.
`"type": "strategies"` turns on tag filters, the NEW badges and the Home banner. `"type": "glossary"` makes the A–Z layout.

---

## Privacy checklist (the site is public)

- No model names (real or stage), photos, usernames, earnings or coworker names.
- No internal links (Slack, the Hub, Google Sites). Only links to Slides, Docs, Drive files, Drive photo folders or YouTube videos, shared only with staff (never "Anyone with the link").
- Keep the wording neutral and professional. Put sensitive detail inside the restricted Slides deck, not in these files.
