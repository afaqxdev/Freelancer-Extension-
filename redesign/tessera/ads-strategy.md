# Tessera — Monetization: Tessera Plus + ads (simple_ads_sdk)
Source: `xdevsoft0/simple_ads_sdk` README (house ad strategy) and `docs/native-templates.md`, read 2026-10-29.
Coins are removed from the whole app. Revenue = **Tessera Plus subscription** + **AdMob ads via simple_ads_sdk**.

## Tessera Plus
- Yearly $19.99 with a 7-day free trial (default, "Best value"), Monthly $2.99. Prices are placeholders [assumption]. Real prices come from Google Play.
- Plus = no ads anywhere (`setPremium(true)` + `premiumResolver`), unlimited hints, 2 streak freezes a week, all tile skins.
- Free rewards that used to be coins: hints, streak freezes, tile skins, and "1 free day of Plus" as the day-7 gift.

## Flow (from the SDK)
```
First launch  Splash → Onboarding → Premium (launch flow) → Home
Later         Splash → Premium (launch flow) → Home
Resume        App-open ad, or Welcome Back when app_open is off
```
Tessera has **no Language screen**, so that step is skipped (SDK rule: don't invent ad moments). `showMissedSplashAd()` goes on the screen after the splash on later launches (Premium).

## Screen → ad map (Figma page "Toybox", "ADS ·" note under every frame)
| Screen | Inline (placement · template) | Full-screen |
|---|---|---|
| Splash | `splash_screen` · style 3 medium | Splash entry ad 500 ms after the native (7 s cap) |
| Onboarding 1–3 | `onboarding_bottom` · style 4 large (one widget under the pager) | Onboarding interstitial on "Let's play!" |
| Premium paywall | none | ✕ launch flow → `interstitial_premium`; ✕ in-app → counter |
| Home | `home_screen` · style 1 ribbon | Counter on "Keep playing" and tab switches |
| Game / not in word list | none (keyboard = app control) | — |
| Result solved | `result_screen` · style 3 medium | Counter on "Next level" |
| So close | none | Rewarded "One more try" (opt-in); counter on "Next level" |
| Out of hints sheet | none | Rewarded "Watch a short ad" → +1 hint |
| Journey map | none | Counter on "Play level 57" |
| Daily word | `daily_screen` · style 1 ribbon | Counter on "Play today's word" |
| Stats | `stats_screen` · style 1 ribbon | — |
| Stats empty | none | Counter on "Play your first word" |
| Welcome Back | `welcome_back_screen` · style 4 large | Welcome Back interstitial on Continue |
| Daily gift, milestone, settings, how to play, error, delete | none | — (claim/toggles/close never count) |

Counter never fires on: back/close, Share, claim, toggles, purchase/restore, permission prompts, or a button that already shows its own full-screen ad.

## Blocked routes (no app-open / Welcome Back)
`/splash`, `/onboarding`, `/premium`, `/welcome-back`, and while the notification permission dialog is up (`AdSafePermissions`). The reminder permission sheet asks only after any full-screen ad has closed.

## Figma deliverables (row "5 · Ads")
- Native templates board (24:217): style 1–4 + loading shimmer as components, in Toybox colours, following the SDK policy checklist (Ad badge, AdChoices, media ≥120×120 with nothing over it, radius ≤ 20).
- Ad loading screen (SDK overlay, via `loadingOverlayBuilder`), full-screen ad placeholder, Welcome Back loading state.

## Needed from the developer before integration (SDK "ask, don't invent")
AdMob app id and unit ids, the Remote Config key, where premium status comes from, route names, and `counter` / `initial_counter` values. Keep `"show_test_ads": true` until real units exist.
