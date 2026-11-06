# Gig Spy

A Chrome side-panel extension for freelancers on **Fiverr** and **Upwork**. It reads the page you have open, studies the competition, and uses the AI of your choice (Claude, ChatGPT or Gemini) to write:

- **Fiverr gigs**: titles, tags, description, 3 packages, FAQ and an action plan
- **Upwork Project Catalog listings**
- **Upwork proposals**: an apply/skip verdict, a bid, opening lines and a cover letter
- **Profile reports**: how your profile compares with 40+ freelancers in your field, with specific changes to make

Everything it writes is based on data from real pages, and it never invents experience, reviews or numbers about you.

> Not affiliated with, endorsed by, or connected to Fiverr or Upwork.

---

## Features

| | Fiverr | Upwork |
|---|---|---|
| Market overview of a search (prices, reviews, seller levels, difficulty, opportunity score) | ✓ | ✓ (jobs and Project Catalog) |
| Keywords: must-use, over-represented in the top 10, long-tail, competitor tags | ✓ | ✓ (skills) |
| Competitor list with filter and CSV export | ✓ | ✓ |
| Write a gig / catalog project from the top competitors | ✓ | ✓ |
| Check every listing against the platform's limits (title length, tags, prices, contact info) and fix it automatically | ✓ | ✓ |
| Job score 0–100 (client trust, competition, freshness, budget fit) with red flags | | ✓ |
| Proposal writer | | ✓ |
| Profile comparison, field by field, against competitors | ✓ | ✓ |
| Your daily rank for a search (when your username is set) | ✓ | |
| Export results as Markdown or PDF | ✓ | ✓ |

## Install

The extension is not in the Chrome Web Store yet. To load it from source:

1. Download this repository (Code → Download ZIP) and unzip it, or `git clone` it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Pin **Gig Spy** to the toolbar and click it to open the side panel.

## Setup

1. **Connect your AI.** Paste an API key from one of these providers. The panel recognizes which provider the key belongs to and checks that it works.

   | Provider | Key starts with | Get one |
   |---|---|---|
   | Claude (Anthropic) | `sk-ant-` | https://console.anthropic.com/settings/keys |
   | ChatGPT (OpenAI) | `sk-` | https://platform.openai.com/api-keys |
   | Gemini (Google) | `AIza` | https://aistudio.google.com/apikey |

   Each provider has a default model. If your provider retires that model, type a current model name in the optional **Model** field.

2. **Pick a platform**, Fiverr or Upwork, and answer its short questions. Only **About you** really matters, because the AI uses only the facts you give it.
3. **Pick a task.** The panel tells you which page to open and reads it automatically.

You pay your AI provider directly for what you use. The extension has no server and no account of its own.

## How it works

```
Fiverr / Upwork tab ──► page reader ──► side panel ──► your AI provider
  (page you opened)     content.js      panel.js        Claude / ChatGPT / Gemini
                        upwork.js       views.js        (structured answer)
                                           │
                                           ▼
                                  chrome.storage.local
                              (settings, cache, results)
```

1. **Read.** The extension reads the data Fiverr and Upwork have already loaded into the page you opened. It doesn't scrape the page's layout.
2. **Analyze.** Keyword, price and competition statistics are calculated in the extension itself (`keywords.js`, `jobs.js`, `profile.js`).
3. **Study competitors.** When you click Generate, it opens the top competitor pages one at a time in background tabs. It reads each page, closes the tab, and waits between pages the way a person would. If a captcha appears, the tab comes to the front so you can solve it. **Stop** writes with whatever has been read so far.
4. **Write.** One AI call returns a structured result.
5. **Check.** Code fixes tags, prices and title prefixes. Anything still breaking the platform's limits goes back to the AI once to be reworded.

Pages it has already read are cached for 7 days, so "Generate again" doesn't read them twice.

## Privacy

- Your API key and settings are stored **only in your browser** (`chrome.storage.local`).
- Page data and your "About you" text are sent **only to the AI provider whose key you entered**, and only when you click an AI action.
- No analytics, no tracking, no server owned by this project.
- **Reset saved data…** in Settings deletes all caches and results but keeps your settings.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Settings, cache and saved results |
| `sidePanel` | The extension's interface |
| `scripting` | Reading the Fiverr / Upwork page you have open |
| `fiverr.com`, `upwork.com` | The pages it reads |
| `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | Sending requests to the AI provider you chose |

## Project structure

```
manifest.json      Chrome extension manifest (MV3)
background.js      Opens the side panel when the toolbar icon is clicked
content.js         Fiverr reader: search results, gig pages, seller profiles
upwork.js          Upwork reader: job search, jobs, Project Catalog, talent search, profiles
panel.html         Side panel markup and styles
panel.js           Core: page reading, AI providers, gig generator, tabs, settings
views.js           Upwork jobs and proposals, profile research, home screen and tasks
keywords.js        Keyword, difficulty and opportunity analysis
gig.js             Gig schema, platform rules, auto-fix and validation
jobs.js            Job market summary, job score, proposal schema
profile.js         Profile aggregation, field comparison and report schema
keywords.test.js   Tests
lib/jspdf.umd.min.js   jsPDF, bundled for PDF export
```

No build step: the files run as they are.

## Tests

```bash
node keywords.test.js
```

The tests cover the keyword analysis, gig rules and auto-fix, job scoring, profile comparison, and Fiverr page routing.

## Limitations

- **The page readers depend on how Fiverr and Upwork build their pages**, and both change without notice. When a page can't be read, the panel shows a short report of what it found (with no personal content) so the reader can be updated. Please include that report in an issue.
- **Research opens real pages in background tabs.** Both platforms limit automated access, so keep runs reasonable and use this at your own risk. The extension never submits proposals, edits gigs or messages anyone. You copy and publish everything yourself.
- **There is no guaranteed ranking.** The extension improves your keywords, pricing and copy based on what is visible on the page. Fiverr and Upwork do not publish their ranking rules.
- AI output can be wrong. Before you publish, check everything listed under **Claims to verify**.

## Contributing

Issues and pull requests are welcome. If a page stopped being read, open an issue with the page type (for example "Upwork profile") and the report the panel shows.

## License

No license has been chosen yet. Until one is added, all rights are reserved.

jsPDF (`lib/jspdf.umd.min.js`) is © its authors under the MIT license.
