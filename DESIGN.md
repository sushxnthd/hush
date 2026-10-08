# Hush website design

The marketing site uses the supplied reference's actual component styles and markup geometry. `assets/reference-site.css` preserves scoped rules for the sidebar, hero, controls, animated loop, features, proof cards, deployment plates, writing rows, CTA and footer. Hush adaptations are explicit at the end of that stylesheet.

The desktop grid is 208px / 108px / 640px, with 64px top spacing and a vertical divider. Geist and Geist Mono are self-hosted. The hero uses 40px type, 44px actions, a 32px setup strip and 2.4:1 blue field. The diagram uses the reference's 640×360 square-elbow tracks, three-layer comets, pixel-grid processing and a 320×484 mobile layout.

`scripts/reference-components.mjs` owns Hush's home page and shared controls, rail and footer. `scripts/reference-loop.html` holds the adapted technical diagram. The generator preserves the working encrypted browser app as its own route.

Hush content replaces every reference claim, customer quote, brand mark and outgoing product destination. Evidence distinguishes bounded internal research from independent assurance. No vendor analytics, cookies or remote executable scripts are imported. The branded dawn image is excluded; the CTA uses the unbranded blue field.

Motion pauses offscreen and in background tabs, respects reduced-motion preferences and has explicit controls. Diagram stages can be selected without autoplay. The setup strip copies a Hush prompt and links to actual setup routes. No JavaScript is required to read the content or follow product links.

Build with `npm run site:build`, then run `npm run site:verify`. The Pages workflow performs both checks before publishing.
