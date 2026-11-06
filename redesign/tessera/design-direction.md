# Tessera — Design direction (v2 concepts)

## Chosen
2026-10-29: **Theme 2 · Toybox** picked by the user. Screens so far (light): Home, Game, Result "Nailed it!", Daily gift. Not yet approved as final (Gate 1); dark mode pending.
User feedback 2026-10-29: the Lagoon look (teal + Fraunces, soft cards) feels "too old". They want something next-level and surprising.

## Product framing
- **Problem:** a quick daily word puzzle that becomes a habit.
- **Audience:** casual adult players on Android, playing in short sessions (commute, evening wind-down).
- **Emotions:** anticipation, a small win every day, pride in the streak.
- **Conventions kept:** green = right spot, amber = wrong spot, grey = not in the word (in each theme's own shades).

## Three concepts (Figma page "Concepts", same Home content in each)
| | Theme 1 · Night Arcade | Theme 2 · Toybox | Theme 3 · Aurora |
|---|---|---|---|
| Mood | Loud, energetic, console-game | Playful, tactile, friendly | Calm, premium, a ritual |
| Palette | #07070C bg, #12121A surface, lime #C8FF2E (brand + correct), amber #FFB224, pink #FF3DAE | cream #FFF3DF, ink #1C1B3A, cobalt #3550FF, tomato #FF5B37, sun #FFC22E, green #2DBE6C | navy #080A1E, violet #7C5CFF, cyan #2EE6D6, pink #FF6FB5, mint #3BE39A, gold #FFC857 |
| Type | Unbounded + Geist + Geist Mono | Bricolage Grotesque + DM Sans | Instrument Serif Italic + Sora |
| Components | Sharp 14–24 radii, 1px lines, mono counters, segmented progress, full-width neon CTA | Ink outlines, hard 3–6px offset shadows (press-down), sticker chips, journey path | Frosted glass cards, glow ring, white pill CTA, floating dock |
| Retention hook shown | Segmented 17/20 region bar | Level journey path with a chest | Progress ring to the region goal |
| Strengths | Very distinctive; dark-first suits evening play | Most fun; rewards feel physical; great for celebrations | Most premium; ring makes progress obvious |
| Trade-offs | Light mode needs its own design; neon can tire the eyes | Busy if overused; outlines on everything need restraint | Blur and glow cost performance on low-end Android; light mode is harder |

Next: the user picks a theme (or mix) → build its UI Kit (light + dark) → redo R1, R2, R4, R5, R6 in it.
