---
name: design-system
description: >
  Enforces the project's design system on every UI component, page, and style
  decision. Always apply this skill when writing any frontend code — components,
  layouts, pages, CSS, Tailwind classes, or inline styles. Trigger when the user
  asks to build a page, component, UI, screen, layout, or anything visual. Also
  trigger when the user says "make it look like the design", "follow the design
  system", "use our colors", or "style this properly". Never use arbitrary
  colors, spacing, or typography that are not defined in the design system.
---

## Design System Source of Truth

All design tokens, colors, typography, spacing, components, and rules live in:

**`docs/design.md`**

Before writing any UI code, **read `docs/design.md` in full**. Every decision — colors, spacing, fonts, component styles, layout — must come from that file.

If `docs/design.md` does not exist yet, create it by asking the user the following questions with `AskUserQuestion`, then write the file:

1. What is the product name and visual personality? (e.g. "enterprise SaaS", "consumer app", "developer tool")
2. What are the primary brand colors? (provide hex values if known, or describe the mood)
3. What fonts should be used? (or should we default to Inter for UI and JetBrains Mono for code?)
4. Are there any existing designs, Figma files, or brand guidelines to reference?

Once you have the answers, generate `docs/design.md` with the full design system — including color tokens (brand, semantic, surface, text), typography scale, spacing scale, layout zones, component specs (buttons, cards, inputs, tables), icon library, motion, and accessibility rules.

---

## Rules (always apply, regardless of project)

1. Never use colors, spacing, or fonts not defined in `docs/design.md`
2. Never hardcode hex values — always reference the named token
3. Always use the component specs from `docs/design.md` for buttons, cards, forms, and tables
4. Always use the icon library and size specified in `docs/design.md`
5. Always keep transitions at the duration and easing defined in `docs/design.md`
6. WCAG AA compliance minimum — maintain 4.5:1 text contrast ratio
7. Keyboard navigation and visible focus states on all interactive elements
