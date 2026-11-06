# Gig Spy: Privacy Policy

_Last updated: November 6, 2026_

Gig Spy is a Chrome extension that helps freelancers research Fiverr and Upwork and write gigs, proposals and profiles with an AI provider the user chooses. This policy explains what data the extension handles and where that data goes.

**In short:** the developer of Gig Spy runs no server and never receives your data. Everything is stored in your own browser. Data is sent only to the AI provider whose key you entered, and only when you start an AI action.

## 1. Data the extension stores

The following is saved in your browser's extension storage (`chrome.storage.local`) on your own device:

- **Settings you enter:** your AI API key, an optional model name, your Fiverr username, "About you" text, current gig title, hourly rate, and your Fiverr and Upwork profile links.
- **Page data it reads:** search results, gig, job and profile details from Fiverr and Upwork pages, kept so the same page isn't read twice.
- **Results:** generated gigs, proposals and profile reports, search statistics, and your daily search rank (only if you set your username).

This data stays on your device. The developer cannot see it. It is deleted when you click **Reset saved data…** in Settings (your settings are kept) or when you remove the extension.

## 2. Data sent to your AI provider

When you click an AI action (for example **Generate my gig**, **Write proposal**, **Research** or **Ask AI**), the extension sends a request to **the one provider whose API key you entered**:

| Provider | Address | Their privacy policy |
|---|---|---|
| Anthropic (Claude) | api.anthropic.com | https://www.anthropic.com/legal/privacy |
| OpenAI (ChatGPT) | api.openai.com | https://openai.com/policies/privacy-policy |
| Google (Gemini) | generativelanguage.googleapis.com | https://policies.google.com/privacy |

The request contains:
- the page data needed for that task (competitor listings, a job post and its client details, or profiles)
- your "About you" text, rate and your own profile details when they are relevant
- your API key, which authenticates the request

When you save your settings, the extension also checks your key with that provider by asking for information about the selected model. That request contains no page data.

The provider handles this data under its own terms and privacy policy. You have an account with them, and your key is linked to that account.

## 3. Pages the extension opens

To study competitors, the extension opens Fiverr or Upwork pages in background tabs in your own browser, reads them, and closes them. This is the same as you opening those pages. It uses your normal browser session and sends nothing anywhere else.

The extension never submits proposals, edits listings, sends messages, or takes any action on your accounts.

## 4. What the extension does not do

- It does not send data to the developer or to any server other than your chosen AI provider.
- It does not use analytics, tracking, advertising or cookies of its own.
- It does not sell, share or transfer your data to anyone.
- It does not use your data for anything other than the features you use, and does not use it to decide creditworthiness or for lending.
- It does not run code loaded from the internet.

The use of information received from Chrome APIs follows the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including its Limited Use requirements.

## 5. Your control

- Change or remove your key and settings at any time in Settings (⚙).
- **Reset saved data…** deletes all saved pages and results.
- Removing the extension deletes everything it stored.
- To delete what your AI provider received, follow that provider's policy.

## 6. Children

Gig Spy is meant for freelancers using Fiverr and Upwork, which require users to be adults. It is not directed at children.

## 7. Changes

If this policy changes, the date at the top is updated and the new version is published in the same place.

## 8. Contact

For questions about this policy, open an issue in the Gig Spy GitHub repository.
