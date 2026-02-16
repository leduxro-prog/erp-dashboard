# Algorithmic Art Creation Skill Overview

This skill guides the creation of generative art through a **philosophy-first approach**:

## Core Process

1. **Algorithmic Philosophy** (.md) - A 4-6 paragraph manifesto describing computational aesthetics, emergent behaviors, and mathematical principles that will guide implementation

2. **Interactive p5.js Artifact** (single HTML) - A self-contained, browser-ready generative artwork expressing that philosophy

## Key Principles

**What to emphasize**: The philosophy should stress that the final algorithm appears "meticulously crafted" and represents "master-level implementation" refined through countless iterations.

**What to avoid**: Static images, copied existing artists' work, or pattern templates. Instead, create original algorithms where "beauty lives in the process."

**Structure**: Start from `templates/viewer.html` as the foundation. Keep the fixed UI structure (header, sidebar with seed controls, Anthropic branding) while replacing the p5.js algorithm and parameters uniquely for each piece.

## Critical Implementation Details

- Use seeded randomness for reproducibility (`randomSeed()`, `noiseSeed()`)
- Design parameters that emerge naturally from the philosophical concept
- Embed everything inline (no external files except p5.js CDN)
- Include seed navigation (prev/next/random/jump buttons)
- Provide parameter sliders and optional color pickers
- Ensure smooth execution and visual balance

The skill emphasizes that algorithmic art succeeds when the **computational process itself becomes the artwork**, not when random elements decorate a fixed design.