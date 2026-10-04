# Supakeep Design System

## Canonical direction

Supakeep uses the **current reference-style editorial infrastructure system**, adapted to Supakeep's own content and product model.

The previous dark/glow interpretation was based on an older reference visual language and is no longer canonical.

## Visual grammar

- white canvas;
- black editorial sans-serif typography;
- very large, low-weight headlines with tight tracking;
- thin pale blue-gray grid lines used as the page skeleton;
- almost no shadows;
- squared / lightly rounded controls rather than pill-heavy UI;
- bright electric blue as the dominant technical accent;
- blue field / systems imagery used sparingly as large full-width visual interruptions;
- numbered infrastructure sections (`001`, `002`, `003`);
- flat rows and tables rather than dashboard card grids;
- research-paper-like captions, labels and figure numbering;
- large quantities of whitespace;
- long-scroll narrative pacing;
- a very large typographic footer.

## Information architecture

Use the same editorial rhythm consistently:

1. primary navigation
2. local section navigation
3. announcement / research strip
4. large centered hero
5. compatibility row
6. mission / thesis prose
7. architecture figure
8. `What we do` rows
9. `In production` evidence and benchmarks
10. deployment blocks
11. security / deployment notes
12. product CTA
13. writing / research index
14. oversized footer

## Color

- background: `#ffffff`
- ink: `#0e1012`
- muted text: `#646b73`
- primary grid line: `#cfdeeb`
- secondary grid line: `#e7eef4`
- pale surface: `#f5f9fd`
- electric blue: `#086fff`
- light blue: `#42a4ff`

Blue is not a decorative gradient sprinkled across the UI. It is reserved for technical emphasis, active calls to action, system diagrams, and large field imagery.

## Typography

Use a neutral platform sans stack:

```css
Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Headlines:
- 52–96px on marketing surfaces;
- low to medium font weight;
- very tight negative letter spacing;
- short, direct sentences.

Technical metadata:
- 10–12px;
- monospace;
- uppercase;
- sparse.

## Components

Prefer:
- border-defined rows;
- figure captions;
- two-column editorial layouts;
- simple tables;
- numbered deployment blocks;
- technical diagrams;
- full-width field images / gradient fields;
- plain text links with arrows.

Avoid:
- dark cyber-security themes;
- card soup;
- glassmorphism;
- heavy shadows;
- excessive pills;
- rounded floating dashboards;
- ornamental neon glows;
- app-store-style feature tiles.

## Supakeep-specific visual idea

The core diagram repeated across the product should be:

```text
private user state
      →
Supakeep Context Kernel
      →
bounded result / authorized action
```

The visual system should make the boundary obvious: private context stays on the user side, bounded outputs cross to agents, and exact values are brokered only to authorized destinations.

## Reference implementation

`index.html` is the current canonical public implementation.

Any future visual redesign must update this document in the same change.