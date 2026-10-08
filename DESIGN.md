# Hush website design

The marketing site uses the supplied reference's actual component styles and markup geometry. `assets/reference-site.css` preserves scoped rules for the sidebar, hero, controls, animated loop, features, proof cards, deployment plates, writing rows, CTA and footer. Hush adaptations are explicit at the end of that stylesheet.

The desktop grid is 208px / 108px / 640px, with 64px top spacing and a vertical divider. Geist and Geist Mono are self-hosted. The hero uses 40px type, 44px actions, a 32px setup strip and 2.4:1 blue field. The diagram uses the reference's 640×360 square-elbow tracks, three-layer comets, pixel-grid processing and a 320×484 mobile layout.

`scripts/reference-components.mjs` owns Hush's home page and shared controls, rail and footer. `scripts/reference-loop.html` holds the adapted technical diagram. The generator preserves the working encrypted browser app as its own route.

Hush content replaces every reference claim, customer quote, brand mark and outgoing product destination. Evidence distinguishes bounded internal research from independent assurance. No vendor analytics, cookies or remote executable scripts are imported. The CTA uses `assets/source/brand/media/hush-dawn.webp`, adapted from the supplied dawn photograph by removing its embedded dotted brain mark. The original asset is preserved separately. The built-in image editor used this instruction: remove only the dotted mark and continue the existing sky, sunset, trees and grain; preserve composition and colors, with no replacement text or logo. The edited output is encoded as WebP for delivery.

The supplied assets used in the published site are the blue meadow film and still, the learn/carry/scale feature clips and posters, all three deployment SVGs, the provider icons, Geist fonts, and the adapted dawn banner. The CTA retains the reference's image framing, gradient scrim, bleed and button motion. Every asset stays self-hosted.

Motion pauses offscreen and in background tabs, respects reduced-motion preferences and has explicit controls. Diagram stages can be selected without autoplay. The setup strip copies a Hush prompt and links to actual setup routes. No JavaScript is required to read the content or follow product links.

Build with `npm run site:build`, then run `npm run site:verify`. The Pages workflow performs both checks before publishing.

## Extended reference audit and Hush page mapping

The supplied archive's 1,000 HTML files were structurally inspected, including duplicated URLs, paginated archives and 159 documentation files. Current public home, product, pricing, research, report, blog, changelog, MCP, coding-agent and policy templates were also checked. Authenticated third-party consoles are outside the marketing-site replica.

| Reference component / page family | Hush implementation |
| --- | --- |
| Production ledger, scrolling 6px pixel blocks, ranked grid bars | Home evidence: platform checks, synthetic task count and frozen violation rates |
| CostCurveChart SVG, red circles / blue squares, grid, tooltip and sliding controls | Frozen AgentCIBench comparison with exact source values, keyboard details and a static data table |
| Research score grid, comparison table, metadata cells and system cards | Research index and two local report pages, linked to full repository protocols |
| Blog ruled entries, hierarchy, metadata and filtering | Writing index with live search over genuine Hush reports and guides |
| ChangesArchive chips, timeline cards and dated entries | Changelog with working type filters and Hush release records |
| Pricing board and original Pro / Max / Scale photographic tiles | Free browser, source runtime and temporary sample access; no invented subscriptions |
| MCP / coding-agent editorial hierarchy, tables and code panels | Local MCP and coding-context pages with actual runtime tool names and scope |
| Legal breadcrumb, metadata rule and prose typography | Hush privacy, terms, security, report and issue-reporting pages |
| Product tables, trace blocks, shared rail, field, source footage and CTA | Existing Hush product and shared components retained |

`assets/reference-pages.css` preserves the page component scopes from the supplied source. `scripts/reference-pages.mjs` adapts the markup. `scripts/reference-stats.mjs` reads the frozen evaluation JSON at build time; no benchmark values animate or change. Only the decorative pixel stream moves. Both chart lines use the same percentage axis; policy categories are discrete, and connections do not imply measurements between policies. Higher completeness and lower violation are explicitly labeled.

The published research tree contains website HTML only. Research scripts, evaluation packages and encoded media sources stay out of the website artifact. The encrypted workspace remains independently isolated.
