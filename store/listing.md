# Chrome Web Store submission: copy and paste

Each section below matches a field in the Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole).

---

## Package

Upload `dist/gig-spy-1.0.0.zip`. Build it with `./pack.sh`.

---

## Store listing tab

**Name** (comes from the manifest): Gig Spy: AI Gig & Proposal Writer

**Summary** (comes from the manifest, 131/132 characters):
Research the competition on Fiverr and Upwork, then write gigs, proposals and profiles with your own Claude, ChatGPT or Gemini key.

**Category:** Productivity → Tools

**Language:** English

**Description:**

```
Gig Spy studies the competition on Fiverr and Upwork and writes for you, based on what is actually ranking. It does not use generic templates.

Open the side panel, pick Fiverr or Upwork, pick a task, and the panel reads the page you have open.

FIVERR
• Write a gig: reads the top 15 competitor gigs for your keyword, then writes 3 titles, 5 tags, a description, Basic/Standard/Premium packages, FAQ and a step-by-step action plan.
• Every gig is checked against Fiverr's limits (title length, tag rules, prices, no contact details) and fixed automatically.
• Keyword research: must-use keywords, keywords over-represented in the top 10, and long-tail phrases with less competition.
• Market overview: price range, review counts, seller levels, a difficulty score and an opportunity score, each with the numbers behind it.
• Track your own daily rank for a search.

UPWORK
• Job market overview for any job search: rates, budgets, client verification and the most requested skills.
• Job score from 0 to 100 for every job (client trust, competition, freshness, fit with your rate) with clear red flags.
• Proposal writer: apply/skip verdict, bid with reasoning, three opening lines, a cover letter specific to the job, questions for the client and screening answers.
• Project Catalog listing writer, based on the top catalog projects.

PROFILES (FIVERR AND UPWORK)
• Compares your profile field by field with up to 25 freelancers in your field: title, skills, rate, portfolio, reviews and more.
• Shows where you are ahead and where you are behind, then gives rewritten titles, a new overview, skills to add or remove, and a prioritized action plan.

HONEST BY DESIGN
• The AI uses only the facts you give it in "About you". It never invents reviews, clients, years or numbers.
• Every result lists the claims you must be able to prove before you publish.
• The extension never submits, edits or sends anything for you. You stay in control.

BRING YOUR OWN AI
Works with your own API key from Anthropic (Claude), OpenAI (ChatGPT) or Google (Gemini). The key is checked when you save it and is stored only in your browser. You pay your provider directly for what you use. There are no subscriptions and no account.

PRIVATE
No developer server, no analytics, no tracking. Your data stays in your browser and is sent only to the AI provider you choose.

Export any result as Markdown or PDF, and competitor lists as CSV.

Gig Spy is an independent tool and is not affiliated with, endorsed by, or connected to Fiverr or Upwork.
```

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots: 1–5 images, **1280×800** PNG or JPEG. See "Screenshots" below.
- Small promo tile (optional): 440×280

---

## Privacy tab

**Single purpose description:**

```
Gig Spy helps freelancers research their competition on Fiverr and Upwork and write gig listings, proposals and profile improvements with an AI provider of their choice.
```

**Permission justifications:**

| Field | Paste |
|---|---|
| storage | Saves the user's settings (including their own AI API key), pages already read, and generated results locally, so research isn't repeated and results stay available. |
| sidePanel | The whole interface is a side panel shown next to the Fiverr or Upwork page the user is working on. |
| scripting | Injects the Upwork page reader into Upwork pages the user opens, and re-adds the Fiverr reader to Fiverr tabs that were open before the extension was installed, to read the listing, job or profile data already loaded in the page. |
| Host permission | fiverr.com and upwork.com: to read search results, gigs, jobs and profiles the user opens, and competitor pages the user asks it to study. api.anthropic.com, api.openai.com and generativelanguage.googleapis.com: to send the user's request to the one AI provider whose API key the user entered. |

**Are you using remote code?** No, I am not using remote code. All JavaScript, including the bundled jsPDF library, is included in the package.

**Data usage (tick these):**
- [x] Personally identifiable information: the name and details on profiles the user researches, and their own profile
- [x] Authentication information: the user's own AI provider API key
- [x] Website content: listing, job and profile text from Fiverr and Upwork pages

Leave everything else unticked: health, financial and payment information, personal communications, location, web history, user activity.

**Certify all three:**
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

(Sending data to the AI provider the user chose is part of the extension's single purpose. It is not a sale or a transfer for unrelated purposes.)

**Privacy policy URL:** the link to `PRIVACY.md` on GitHub, for example
`https://github.com/<your-username>/<repo>/blob/main/PRIVACY.md`

---

## Distribution tab

- **Visibility:** start with **Unlisted** (only people with the link can install it), then switch to Public after the first reviews.
- **Regions:** all regions.
- **Pricing:** free.

---

## Screenshots (1280×800)

Take these from the real extension. Window size: 1280×800, side panel open.

1. **Gig written:** the "My Gig ✦" tab with a finished gig. Caption: "A complete gig, written from the top-ranking competitors"
2. **Market overview:** the Overview tab on a Fiverr search. Caption: "See the price, the competition and your real chances before you start"
3. **Keywords:** the Keywords tab. Caption: "Keywords the top 10 actually use"
4. **Upwork proposal:** a job with its score and a finished proposal. Caption: "Check the client, then send a proposal written for that job"
5. **Profile report:** the profile comparison table. Caption: "See exactly where your profile is behind, and how to fix it"

Before capturing, make sure no screenshot shows your API key, private messages, or other people's personal details you don't want to publish.

To capture on a Mac: press Cmd+Shift+4, then Space, and click the Chrome window. Then resize the image to exactly 1280×800, for example in Preview: Tools → Adjust Size.
