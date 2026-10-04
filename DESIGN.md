# Supakeep Design System

## Canonical direction

Supakeep uses the current reference-style **rail + editorial content column** system, adapted to Supakeep's own product, language, diagrams, evidence, and navigation.

The saved reference HTML supplied during design review is the structural reference. Do not reinterpret it as a generic grid landing page.

## The anatomy that matters

Desktop:

```text
persistent left rail        editorial content column
┌───────────────────┬────────────────────────────────────┐
│ wordmark          │ note / announcement                │
│ Human / Agent     │                                    │
│                   │ large left-aligned statement       │
│ Home              │ short deck                         │
│ Product           │ two compact actions                │
│ Writing           │ setup/prompt rail                  │
│ Evidence          │ compatibility row                  │
│ Docs              │ technical figure                  │
│                   │                                    │
│ ─────────────     │ manifesto prose                    │
│ │ Mission         │                                    │
│ │ What we do      │ ruled definition rows              │
│ │ In evidence     │ production/evidence table          │
│ │ Writing         │ numbered infrastructure blocks     │
│ │ Research        │ CTA / writing / research           │
│ ■                 │ footer                             │
└───────────────────┴────────────────────────────────────┘
```

The left rail is not optional on desktop. It is one of the strongest visual signatures.

## Visual grammar

- white canvas;
- persistent narrow left rail with a thin right rule;
- one comparatively narrow content column rather than a centered full-bleed marketing canvas;
- Geist-like neutral grotesk typography;
- very small navigation and metadata type;
- low-weight editorial display typography;
- left-aligned hero copy;
- thin neutral-gray rules;
- plain text and ruled rows over decorative cards;
- monospace captions and technical labels;
- compact square/rectangular controls;
- extremely restrained blue usage;
- almost no shadows;
- no glassmorphism;
- no generic SaaS card grid.

## Navigation

Desktop rail contains:

1. Supakeep wordmark
2. `Human / Agent` format switch
3. site-level links
4. horizontal divider
5. section-local links
6. vertical ruler and moving square marker
7. quiet project status at the bottom

Mobile collapses the rail into a compact sticky bar.

## Homepage rhythm

1. small announcement line
2. large statement
3. one-sentence deck
4. two compact buttons
5. setup-prompt strip
6. small compatibility line
7. bordered technical figure
8. manifesto article
9. `What we do` definition-list rows
10. evidence / benchmark section
11. deployment / boundary blocks
12. compact CTA
13. Writing list
14. Research close
15. structured multi-column footer

## Color

- paper: `#ffffff`
- ink: `#111315`
- muted: `#697078`
- faint: `#9aa1a8`
- primary rule: `#dfe5ea`
- secondary rule: `#eef2f5`
- blue: `#0877ff`
- pale blue: `#eef6ff`

Blue is an accent, not the page identity.

## Typography

Preferred stack:

```css
"Geist", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Navigation:
- ~12px
- regular/medium weight
- tight vertical rhythm

Hero statement:
- roughly 46–72px depending on viewport
- low/medium weight
- very tight tracking
- left aligned
- intentionally not full viewport width

Body thesis prose:
- ~21px
- generous leading
- narrow readable measure

Technical text:
- 10–11px monospace

## Supakeep-specific visual model

The repeated product figure is:

```text
private user state
      →
Supakeep Context Kernel
      →
bounded result / authorized action
```

The visual system should make one fact obvious: the private profile stays on the user side; computation crosses the boundary, not the profile.

## Avoid

- centered 96px SaaS heroes;
- top-navigation-only layouts on desktop;
- decorative blue gradient fields as the main identity;
- floating feature cards;
- dashboard screenshots used as hero decoration;
- cyber-security dark mode;
- glass surfaces;
- excessive rounded corners;
- badge/pill overload.

## Reference implementation

`index.html` is the canonical public implementation.

Future visual changes must preserve the rail/content anatomy unless this document is deliberately changed in the same commit.