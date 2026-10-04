# Supakeep Design System

## Canonical direction

Supakeep uses a **dark AI-infrastructure visual system inspired by reference's current web language**, adapted to Supakeep's own product, claims, diagrams, copy, and interaction model.

This means:

- near-black canvas;
- large centered editorial headlines;
- thin technical grid lines and borders;
- electric-blue light as the single dominant accent;
- infrastructure diagrams as primary visuals;
- long-scroll narrative pacing;
- flat evidence and benchmark sections;
- sparse controls and minimal ornament;
- a large typographic footer.

Do not copy reference's proprietary code, logos, illustrations, or product copy. The goal is to preserve the visual grammar while making the page unmistakably Supakeep.

## Core visual tokens

```text
background      #07090d
panel           #0d1118
panel-secondary #101620
text            #f7f8fb
muted           #8c96a7
subtle          #5e6878
border          #1b2330
blue            #1787ff
cyan            #53c8ff
success         #63d39b
warning         #ffbd66
danger          #ff7e86
```

Blue is the product accent. It should appear as a controlled glow, graph connection, CTA, result state, or technical highlight. Do not introduce competing brand colors.

## Typography

Use a neutral modern sans stack:

```css
Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
```

Headlines:

- large, centered where appropriate;
- tight tracking;
- medium rather than ultra-bold weight;
- short, declarative copy;
- high contrast against the canvas.

Body copy should be cool gray, compact, and technically precise.

## Layout system

The marketing page should follow this sequence:

1. compact dark navigation;
2. centered hero with announcement pill and two CTAs;
3. broad infrastructure visualization;
4. manifesto-scale statement;
5. architecture figure;
6. flat `What we do` rows;
7. evidence / benchmark metrics;
8. deployment surfaces;
9. security boundary / caveats;
10. research writing index;
11. large closing CTA;
12. oversized typographic footer.

Avoid generic startup-card grids. The page should read more like a technical research/infrastructure site than a SaaS dashboard.

## Product visuals

Prefer diagrams over decorative illustration.

Canonical Supakeep diagram:

```text
private user world
       |
       v
Supakeep Context Kernel
       |
       +-- private decision programs
       +-- information budgets
       +-- scoped grants
       +-- credential brokerage
       +-- receipts
       |
       v
bounded result / authorized action
       |
       v
any AI / MCP / browser / app
```

The visual story must repeatedly reinforce that private state stays on the user's side and only bounded outputs or authorized destination-specific values cross the boundary.

## Interaction

- Keep motion subtle and purposeful.
- Use blue glow to indicate computation or active data flow.
- Avoid continuous distracting animation.
- Interactive demos should show state transition clearly: idle -> local computation -> bounded result / deny.
- Respect `prefers-reduced-motion`.

## Copy style

Use concise infrastructure language rather than security fear language.

Preferred examples:

- `Private Mode for every AI`
- `Personal context moves toward the decision, not toward the model.`
- `Bound the information channel.`
- `Broker authority, not secrets.`
- `Mechanisms we can reproduce, not marketing claims.`

Avoid vague phrases such as `AI-powered privacy`, `military-grade`, `ultimate protection`, or unsupported claims of safety.

## Canonical implementation

`index.html` is the current reference implementation.

Any future redesign should update this file and this document together so the visual system does not drift.
