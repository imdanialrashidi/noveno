# Product Design Contract

Keep this document specific, short, and durable. It is the visual and interaction source of truth shared by design, implementation, browser QA, and review. Replace template prompts with accepted decisions; do not preserve a menu of unused options.

## Experience brief

- Product / surface:
- Primary audience:
- Single job of this surface:
- Desired user feeling before → after:
- Success signal:

## Brand character

Describe useful tensions rather than vague adjectives.

- [character], not [failure mode]
- [character], not [failure mode]
- [character], not [failure mode]

## Reference calibration

| Reference | Adopt | Avoid | Why it fits this product |
|---|---|---|---|
|  |  |  |  |

References calibrate principles; they are not permission to clone another product.

## Direction

- Visual thesis:
- Signature element:
- One justified aesthetic risk:
- What must feel familiar:
- What must never look generic:

## Semantic tokens

### Color

| Role | Value | Foreground/background use | Contrast proof |
|---|---|---|---|
| canvas |  |  |  |
| surface |  |  |  |
| text |  |  |  |
| muted text |  |  |  |
| action |  |  |  |
| accent |  |  |  |
| danger / success / warning |  |  |  |

### Typography

| Role | Family / fallback | Scale / weight / leading | Purpose |
|---|---|---|---|
| display |  |  |  |
| body |  |  |  |
| utility / data |  |  |  |

Record font source and license. Define a fallback that preserves hierarchy and metrics acceptably.

### Geometry and depth

- Spacing/rhythm:
- Grid/content measure:
- Radius logic:
- Border/shadow logic:
- Icon/media treatment:

### Media and art direction

- Photography / illustration / data-visualization language:
- Subject, framing, crop, lighting, texture, and color treatment:
- Icon family and stroke/fill rules:
- Asset source, ownership/license, and attribution:
- Responsive art direction and meaningful alt-text rules:
- Fallback when the preferred asset cannot load:

## Composition and responsiveness

- Desktop composition:
- Mobile recomposition:
- Dense/long-content behavior:
- Supported viewport/device baseline:
- RTL/localization behavior:

## Components and states

| Component / pattern | Variants | Required states | Reuse or change |
|---|---|---|---|
|  |  | default / hover / focus / active / disabled / error |  |

Required journey states:

- loading:
- empty:
- error/retry:
- success:
- permission/offline where relevant:

## Motion and feedback

- Orchestrated moment (or explicit none):
- State-transition motion:
- Duration/easing tokens:
- Reduced-motion alternative:
- Sound/haptics where applicable:

## Content voice

- Vocabulary and tone:
- Action-label rules:
- Error and empty-state rules:
- Realistic content fixtures:

## Quality budgets

- Accessibility target: WCAG 2.2 AA unless the product accepts another target.
- Text/non-text contrast target:
- Keyboard/focus/touch target:
- Performance target: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 unless stricter product budgets are accepted.
- Pre-release lab budget and production RUM/rollout proof:
- Image/font/JS budget:
- Supported browsers and input modes:

## Screen acceptance

| Flow / screen | Critical states | Viewports/locales | Visual proof |
|---|---|---|---|
|  |  |  |  |

## Decisions intentionally deferred

-

## Decision log

| Date | Decision | Evidence / rationale | Revisit when |
|---|---|---|---|
|  |  |  |  |
