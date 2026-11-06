# Tessera — status
- Task: retention-focused redesign of Tessera (remaster). Android only. Ads: optional rewarded + capped interstitials. Deliverable: Figma only. **Light mode only** (user: no dark mode).
- Original Figma (read-only for us): https://www.figma.com/design/Bylp0aWlZnC3bmQtWS5eXv. "4 · Play with friends" there is NOT deleted (no edit access).
- **Our Figma:** https://www.figma.com/design/2BbhR9ptNg25AqUyBJyAwX
  - Page **Toybox** (11:69): the complete app, 24 screens in 4 rows:
    1. Start (y 0): Splash 15:64, Onboarding 1–3 15:88 / 15:140 / 15:169, Home 11:70
    2. Play (y 1200): Game typing 11:161, Not in word list 16:68, Result solved 13:31, So close 16:215, How to play 16:269, Out of hints 16:459
    3. Daily, progress & rewards (y 2400): Daily gift 13:97, Streak milestone 17:132, Welcome back 17:215, Journey map 17:268, Daily word 18:126, Stats 18:267, Stats empty 18:365
    4. Shop, settings & system (y 3600): Shop 19:166, Purchase complete 19:293, Settings 19:328, Reminder permission 20:201, No connection 20:311, Delete data 20:335
  - Older pages: Concepts (3 directions), Daily loop (rejected Lagoon version), Foundations (Lagoon variables + icon components used by Toybox).
- 2026-10-29 monetization change: **coins removed everywhere** (verified: no coin text/icons left). Shop + purchase screens replaced by Premium paywall 26:209 and "You're Plus!" 26:275; Shop tab → Plus tab. Ads per simple_ads_sdk README (see `ads-strategy.md`): natives on splash/onboarding/home/result/daily/stats/welcome back; Welcome Back rebuilt 28:315 (+ loading state 28:357); row 5 "Ads" = native templates board 24:217 (components), SDK loading screen 28:391, full-screen ad placeholder 28:413. "ADS ·" note under every frame. No Language screen (skipped per SDK rule).
- 2026-10-30: row 6 "Dialogs & snackbars" (y≈6700): Snackbar set 36:362 + Dialog set 36:409 (4 tones each, text props), message boards 37:347 / 37:421, in-context 37:458 / 37:606 / 37:748. Specs sent to the Flutter session (local_bddb01ca…).
- Toybox styling is hard-coded hex per screen (no Toybox variables/components yet).
- Not designed: weekly league, word album, weekend event, tablet/small-phone layouts, app icon, motion.
- App icon (page "App icon" 21:2): concepts 21:3 / 21:10 / 21:18. **User picked Mosaic.** Final set (y≈960) with export settings: ic_launcher_background 22:4, ic_launcher_foreground 22:6, ic_launcher_monochrome 22:22 (432px + SVG), Play Store icon 22:29 (512 PNG), legacy ic_launcher 22:36 + ic_launcher_round 22:42 (48/72/96/144/192). Mask previews (circle/squircle/rounded/teardrop) and light/dark wallpaper checks beside them. Art sits inside the 66dp safe zone.
- Next: user review → fixes; optional: Toybox components/variables, motion, store screenshots.
