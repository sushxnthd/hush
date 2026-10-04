# Supakeep Design System

## Canonical direction

Supakeep uses the supplied reference homepage bundle as a **measurement reference**, not as loose moodboard inspiration. The public page should preserve reference's compact rail/editorial-column anatomy while replacing product content, diagrams, branding, and evidence with Supakeep's own.

## Exact desktop constants recovered from the supplied CSS

```css
--rail-w: 208px;
--rail-gap: 108px;
--col-w: 640px;
--sp-rail-top: 64px;
--sp-col-top: 64px;
--sp-section: 72px;
--fs-statement: 40px;
--lh-statement: 1.12;
--fs-dek: 17px;
--fs-body: 17px;
--paper: #f4f4f6;
--ink: #0b1015;
--rule: #dfdfdf;
--blue: #0562ef;
```

Desktop page width is therefore approximately `208 + 108 + 640 = 956px`, centered in the viewport. A vertical rule sits in the rail/content gap. Do **not** widen the content column into a generic marketing canvas.

## Core anatomy

```text
208px rail       108px gap         640px editorial column
┌──────────────┐        │       ┌──────────────────────────┐
│ wordmark     │        │       │ announcement             │
│ Human/Agent  │        │       │ 40px statement           │
│              │        │       │ 17px deck                │
│ site nav     │        │       │ 44px mono CTAs           │
│              │        │       │ setup prompt strip       │
│ section nav  │        │       │ compatibility row        │
│ ruler/marker │        │       │ 2.4:1 technical field    │
│              │        │       │ manifesto                │
└──────────────┘        │       │ ruled product rows       │
                                │ compact evidence blocks  │
                                │ deployment plates        │
                                │ CTA / writing / footer   │
                                └──────────────────────────┘
```

## Typography

The reference uses Geist and Geist Mono. Supakeep should use the same metrics where available, with neutral system fallbacks.

- hero statement: `40px / 1.12`, weight 400, `-0.03em`
- deck/body: `17px`, body leading around `1.6–1.65`
- section title: `24px`, weight 400
- production creed: `30px / 1.28`
- navigation: `15px / 1.4`
- labels/buttons: 11–12px Geist Mono
- primary CTA: `44px` high, ~`208px` minimum width

The hero is intentionally compact. Never convert it to a 70–100px centered SaaS headline.

## Motion

Motion is part of the reference system and must stay coherent across the whole page. Do not add one-off durations or easing curves to individual components.

Canonical tokens:

```css
--ease-standard: cubic-bezier(.4,0,.2,1);
--ease-hover: cubic-bezier(.25,.1,.25,1);
--dur-hover: .2s;
--dur-press: .12s;
--dur-reveal: .3s;
--dur-cta: .36s;
--ease-cta: cubic-bezier(.23,1,.32,1);
```

Behavior:

- first-screen reveal sequence: announcement `40ms`, statement `120ms`, deck `200ms`, actions `260ms`, prompt strip `280ms`, compatibility row `320ms`, hero figure `340ms`;
- scroll reveals use the same `300ms` opacity + `10px` vertical translation and standard easing;
- `What we do` rows stagger at `60 / 120 / 180ms`, with the supporting link at `240ms`;
- ordinary hover state changes use `200ms` hover easing;
- button press feedback uses `120ms`;
- primary CTA uses the reference-style `360ms` tile/rail animation rather than an unrelated scale or glow effect;
- the rail marker tracks section progress continuously on `requestAnimationFrame`, rather than jumping between hard-coded positions;
- reduced-motion users get immediate reveals and no decorative CTA/marker motion;
- geometry must not shift during reveals or hover states.

## Components that define the look

1. persistent sticky left rail on desktop
2. rounded `Human / Agent` mono format switch
3. sparse 15px vertical site navigation
4. separate section navigation with ruler ticks and a 6px blue moving square
5. compact announcement strip with green live dot and white bordered CTA tile
6. two 44px mono action buttons
7. 32px setup-prompt rail directly below actions
8. small compatibility row
9. 2.4:1 technical field interruption
10. narrow manifesto text at 17px
11. `What we do` rows with 56px technical tiles and copy to the right
12. compact white evidence/stat blocks separated by 12px gaps
13. three bordered deployment plates
14. dark photographic/field-style CTA that bleeds 32px beyond the 640px column
15. bordered numbered Writing rows
16. quiet four-column footer

## Responsive behavior

At `<=1000px` the persistent rail collapses into a horizontal sticky bar and the page becomes one column, max width roughly `720px`.

At `<=600px`:
- hero statement ~34px
- body/deck ~16px
- actions stack
- field becomes 16:9
- evidence and deployment grids collapse to one column

## Supakeep content model

The repeated product abstraction remains:

```text
private user state
      →
Supakeep Context Kernel
      →
bounded result / authorized action
```

The visual design may closely match the reference system; the actual branding, copy, product diagrams, claims, data, and destinations must remain Supakeep-specific.

## Avoid

- centered giant SaaS heroes
- wide 900–1200px content canvases
- top-nav-only desktop layouts
- cyber-security dark themes
- floating card grids
- pill-heavy interfaces
- glassmorphism
- thick borders or shadows
- decorative gradients used everywhere
- mixed easing curves or arbitrary animation durations
- motion that moves layout rather than only presentation

`index.html` is the canonical homepage. All four page routes use `assets/site.css` and `assets/site.js` for typography, navigation, responsive layout and motion.

Geist and Geist Mono are self-hosted under `assets/fonts/` with their SIL Open Font License. The mobile rail has a keyboard-accessible navigation toggle; the setup strip is a native details disclosure with a copy action. Content remains readable if JavaScript is unavailable.