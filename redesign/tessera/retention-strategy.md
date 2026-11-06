# Tessera — Retention Strategy (Hidden Words)
> **Superseded 2026-10-29 for money and ads:** coins are removed. Monetization is Tessera Plus + simple_ads_sdk; see `ads-strategy.md`. The retention loops below still apply, with coin rewards replaced by hints, freezes, tile skins and a free Plus day.
Target platform: **Android only** (Step 0, 2026-10-29)
Monetization: **coins + Tessera Plus + ads** (user: "we will integrate the ads")
Deliverable: **Figma designs only**, added to the original Tessera file (needs edit access, see Open questions)

## Goal
Get players to come back every day and keep the app installed, using habits and rewards they enjoy. We don't trap them. Players uninstall word games mostly over **too many ads between levels** and **puzzles that start to feel repetitive** [verified: review aggregators, see Sources]. So this plan aims to give a daily reason to return and a long-term goal, with ads that never get in the way of play.

## What Tessera already has [verified: Figma page "Phase 5 — Full design (Lagoon)"]
| Area | Existing screens | Retention value today |
|---|---|---|
| Daily word | 3.1, 3.2 (countdown) | Daily return reason ✔ |
| Streak | Home shows 🔥12, Stats 3.3 | Counter only. Nothing protects it, no milestones |
| Levels | Home "Level 57" | Endless levels with no structure or end goal |
| Coins / Shop / Plus | 5.1–5.3 | Coins only buy hints |
| Reminder permission | 6.2 | Sheet exists; when it appears isn't defined |
| Play with friends | 4.1–4.6 (user is removing) | Losing this removes the only social loop. A league can replace it |

## Retention loops (proposal)
### Daily loop: "one more day"
1. **Daily gift calendar (7 days):** coins on days 1–6, a chest on day 7. Missing a day pauses the calendar; it never resets it.
2. **Streak with freeze:** 1 free freeze each week, more from the shop or by watching an ad. A missed day uses the freeze automatically. A day runs until **4:00 am local** so late players don't lose their streak [verified pattern].
3. **Streak milestones** at 3, 7, 30, 100 and 365 days: celebration, badge and coins.
4. **3 daily quests** (e.g., "Solve in 3 tries", "Use no hints", "Play the daily word"). Finishing all 3 gives a bonus.

### Mid-term loop: "this week"
5. **Weekly league:** 30 players at a similar level; the top 5 move up to the next tier (Bronze, Silver, Gold, Lagoon). This replaces the social loop lost by removing friends. [assumption: needs backend]
6. **Weekend event:** a themed word pack (e.g., "Ocean words") with its own tile reward.

### Long-term loop: "my collection"
7. **Journey / season path:** levels are grouped into named regions of 20. Finishing a region unlocks a tile theme. Level 57 becomes "Coral Reef 17/20".
8. **Word album:** each solved word goes into a personal dictionary with its meaning; rare words are marked. This gives a sense of progress that doesn't depend on rewards.

### Comeback
9. **Welcome back screen** after 3+ days away: a small gift and one chance to repair the streak (coins or an ad). No guilt-trip messages.
10. **Notification permission** asked after the **first daily-word win** (Android 13+ guidance: ask in context, not on first launch) [verified: developer.android.com]. Never more than 1 reminder a day, and the time is set by the player.

## Ad plan (Google Play–compliant)
| Placement | Type | Rule |
|---|---|---|
| Out of hints → "Watch for a hint" | Rewarded (opt-in) | Always optional; exempt from interstitial rules [verified: Play policy] |
| Result screen → "Double coins" | Rewarded | Optional button next to the normal Continue button |
| Streak repair / extra freeze | Rewarded | Max 1 a day |
| Out of tries → "+1 row" | Rewarded | Max 1 per puzzle |
| Between levels | Interstitial | Only at a natural break, **every 4th level, never in the first 10 levels, never after the daily word**, skippable [verified: Play allows natural breaks] |
| Tessera Plus | — | Removes interstitials; rewarded ads stay optional |

Never: ads during a puzzle, fake close buttons, ads that look like system notifications [verified: Play policy], or countdown pressure on a purchase.

## Ethical guardrails
- No fake timers, scarcity or "only 2 left" in the shop.
- Streak freeze and a 4 am grace period so streaks don't cause anxiety.
- Reminders can be turned off in one tap from Settings; never more than 1 a day.
- Everything that can be bought can also be earned by playing.
- Prices are shown in local currency through Play Billing, with no hidden recurring charges.

## Proposed new screens (Figma, light + dark)
| # | Screen | Loop |
|---|---|---|
| R1 | Daily gift calendar sheet | Daily |
| R2 | Home v2: streak flame + freeze, 3 quests, league chip | Daily |
| R3 | Streak at risk banner + freeze shop item | Daily |
| R4 | Streak milestone celebration (7 days) | Daily |
| R5 | Result v2: coins earned, quest progress, "Double with ad", next goal | Daily |
| R6 | Rewarded ad offer sheet (hint / +1 row / repair) | Ads |
| R7 | Weekly league leaderboard | Weekly |
| R8 | Journey / region map | Long-term |
| R9 | Word album | Long-term |
| R10 | Welcome back screen | Comeback |
| R11 | Notification priming after first win (update of 6.2) | Comeback |
| R12 | Weekend event card + event screen | Weekly |

## Open questions
- **Figma edit access:** the file opens read-only for account "Ubaid Ullah". Needs edit access from the owner, or a duplicate in your drafts (then share the new link).
- League and events need a backend. Is there one, or should these be designed as offline/local first?
- Which ad SDK (AdMob assumed)?

## Sources & tools
- Play disruptive ads / rewarded exemption: https://support.google.com/googleplay/android-developer/answer/12271244, https://support.google.com/googleplay/android-developer/answer/9857753
- Android notification permission: https://developer.android.com/develop/ui/views/notifications/notification-permission
- Word-game complaints (ads, repetition): https://unstar.app/blog/wordscapes-words-with-friends-nyt-games-sudoku-word-cookies-word-games-ranked-2026, https://kimola.com/reports/words-of-wonders-unveiling-player-insights-ad-impact-google-play-en-us-152295 (aggregators; directional only)
- Benchmarks (word games top-25% D7 ≈ 19%): https://medium.com/ironsource-levelup/retention-framework-keep-your-players-forever-43fa60298abf [directional]
- Streak freeze / milestones patterns: https://duolingo.deconstructoroffun.com/mechanics/streaks, https://support.elevateapp.com/hc/en-us/articles/28507604797595-What-is-a-streak-freeze
- Tools: Figma MCP (read-only inspection), WebSearch.
