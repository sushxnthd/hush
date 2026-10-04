# Supakeep Design System

## Design direction

Supakeep should feel like **Private Mode for AI**, not like enterprise security software.

The visual reference is Kree8 Studio's restrained TripStat travel interface: pale neutral canvas, bright white device-like surfaces, oversized editorial typography, sparse black controls, light-blue utility accents, generous breathing room, and almost no decorative noise.

This is a thematic adaptation, not a literal copy.

## Principles

1. **Calm by default.** The product deals with trust and private context; the interface should lower cognitive load rather than dramatize risk.
2. **One dominant action per region.** Do not create rows of equally loud buttons.
3. **Content wins.** Branding, gradients, badges, and illustrations never compete with the task state.
4. **Progressive disclosure.** Show the plain-language answer first; technical privacy details are secondary.
5. **Familiar interactions.** Navigation, approvals, lists, toggles, and destructive actions should behave as people expect.
6. **State must be readable without color.** Color supports meaning; labels and structure carry it.
7. **Private data should visually stay local.** Local-only context, bounded outputs, and direct brokered disclosures must be visually distinct.
8. **Avoid AI dashboard tropes.** No glowing cyber grids, neon gradients, floating glass-card piles, excessive pills, or ornamental status chips.

## Color

- `paper`: `#f4f4f1`
- `surface`: `#ffffff`
- `surface-2`: `#f8f8f6`
- `ink`: `#0d0e10`
- `muted`: `#74767b`
- `line`: `#e7e7e3`
- `accent-blue`: `#4f86ff`
- `accent-blue-soft`: `#eaf1ff`
- `success`: `#37a66d`
- `warning`: `#d5902e`
- `danger`: `#c95555`

Use blue sparingly for selected states, bounded-result indicators, links, and the occasional product-level emphasis. Primary actions remain near-black.

## Typography

Use the platform/system stack first:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif
```

Headlines:
- very tight tracking
- large scale
- short line lengths
- sentence case

Body:
- neutral system text
- comfortable line-height
- avoid long dense blocks

Metadata:
- small but never cryptic
- uppercase only for short labels like `CURRENT TASK`

## Shape

- large environmental/frame radius: 28–42px
- primary surfaces: 18–24px
- controls: 8–12px
- primary CTA: full capsule only when it is clearly the one dominant action

Do not turn every label into a pill.

## Layout

- generous outer whitespace
- strong top-to-bottom reading order
- align related content precisely
- prefer flat lists with separators over nested cards
- use a single framed product surface for interactive demos
- keep mobile touch targets at least ~44px where practical

## Motion

- motion explains state change; it does not decorate idle screens
- 150–220ms for common interactions
- subtle translation/opacity only
- respect `prefers-reduced-motion`
- no pulsing security indicators except where active state would otherwise be unclear

## Copy

Prefer direct, action-oriented labels:

- `Allow once`
- `Deny`
- `Open Private Mode`
- `Used locally`
- `Returned to the AI`
- `Brokered directly`

Avoid cute security language, fear-based copy, and vague CTAs.

## Canonical visual concept

**AI should query you, not copy you.**

The UI should repeatedly make three layers understandable:

```text
private context (stays with user)
        ↓ local computation
bounded result (may reach model)
        ↓ authorized action
exact data only to required destination
```

## Reference implementation

The current public implementation is `index.html`.

All future UI work should preserve this system unless a deliberate redesign updates this document first.
