# E-Ink Style Guide

This guide defines an e-ink-compatible visual system using Tailwind-friendly conventions.

## Core Rules

- Design in monochrome first. Every screen should remain understandable in grayscale.
- Default to black text on white backgrounds.
- Communicate state with typography, inversion, rules, and outlines before color.
- Keep surfaces flat. Use rules to separate sections instead of borders, shadows, or elevation.
- Do not use hover styles, transitions, or decorative animation.

## Tailwind Color Rules

### Allowed Base Colors

- Text: `text-black` and `text-white` only
- Backgrounds: `bg-white` by default, `bg-black` for active or emphasized states
- Section rules and focus outlines: black only

### Restricted Accent Variables

Accent colors are optional and should be rare. If used, they must only appear as solid fills for non-essential emphasis such as diff markers, badges, or icons.

| Variable                    | Value     |
| --------------------------- | --------- |
| `--color-accent-dark-gray`  | `#404040` |
| `--color-accent-mid-gray`   | `#808080` |
| `--color-accent-light-gray` | `#c0c0c0` |
| `--color-accent-red`        | `#ff6163` |
| `--color-accent-green`      | `#00b036` |
| `--color-accent-navy`       | `#000084` |
| `--color-accent-aqua`       | `#00f0ff` |
| `--color-accent-violet`     | `#ee00ff` |
| `--color-accent-orange`     | `#ffaa00` |
| `--color-accent-lemon`      | `#f0ff00` |
| `--color-accent-chartreuse` | `#008000` |
| `--color-accent-grape`      | `#9338be` |
| `--color-accent-sky`        | `#00aaff` |
| `--color-accent-orange-red` | `#ff4400` |

### Color Usage Rules

- Do not use accent colors for body text.
- Do not use accent colors for structural separators.
- Do not rely on color alone to communicate meaning.
- Do not use gradients.
- Do not use translucent overlays as the primary way to show state.
- Essential UI should still work if all accent colors are removed.
- Prefer the named accent variables in `app/app.css` instead of inline hex values.

## Typography

### Font Families

- Body copy: `font-[Charter,"Bitstream_Charter",Georgia,serif]`
- Code, logs, diffs: `font-["Fira_Code",ui-monospace,monospace]`

### Tailwind Type Scale

Use Tailwind's default typography scale.

| Role               | Tailwind class |
| ------------------ | -------------- |
| Caption / metadata | `text-sm`      |
| Body               | `text-base`    |
| Emphasized body    | `text-lg`      |
| Section title      | `text-2xl`     |
| Page title         | `text-3xl`     |
| Masthead           | `text-5xl`     |

### Typography Rules

- Default body text should use `text-base leading-6` or `text-lg leading-7`.
- Long-form reading surfaces should prefer `text-lg leading-7`.
- `h1` should typically use `text-3xl`.
- `h2` should typically use `text-2xl`.
- Small labels may use `text-sm`.
- Use `font-bold` for hierarchy before changing size aggressively.
- Use `uppercase tracking-[0.08em]` for section labels and utility headings.
- Use `tracking-[0.05em]` for small-caps-like headers when needed.
- Do not use all-caps for long sentences or paragraphs.

## Spacing

Use Tailwind's default spacing scale only.

| Tailwind | Typical use              |
| -------- | ------------------------ |
| `0.5`    | Fine offsets only        |
| `1`      | Tight internal spacing   |
| `2`      | Tight row gaps           |
| `3`      | Standard compact padding |
| `4`      | Default block spacing    |
| `6`      | Major block spacing      |
| `8`      | Section spacing          |

### Spacing Defaults

- Inline control gap: `gap-2`
- Standard row or control padding: `px-3 py-2`
- Dense row padding: `px-3 py-1`
- Panel or grouped section padding: `p-3` or `p-4`
- Main content padding: `p-6`
- Standard vertical rhythm between related blocks: `space-y-4`
- Major vertical rhythm between sections: `space-y-6` or `space-y-8`

Do not introduce custom spacing values such as `5px`, `6px`, `13px`, or `18px` when a Tailwind step is available.

## Sizing Defaults

- Minimum interactive height: `min-h-11`
- Minimum interactive width for square or icon-only controls: `min-w-11`
- Secondary compact controls may use `h-9 min-w-9`
- Common icon size inside controls: `size-6`
- Sidebar-width patterns should use Tailwind width utilities or an explicit layout token, not ad hoc pixel values.

## Rules, Corners, And Surfaces

- Default surface: `bg-white`
- Default text: `text-black`
- Corners should remain square; avoid rounded corners unless there is a strong functional reason.
- Do not add enclosing borders to components.
- Use rules sparingly - only to separate sections or mark selection.
- Do not use `shadow-*` utilities.
- Do not use ring-based visual styling except when needed to support a black focus outline.

### Rule Patterns

- Major section separator: `border-t-2 border-black/50` or `border-b-2 border-black/50`
- Strong section separator: `border-t-2 border-black` or `border-b-2 border-black`
- Selection marker for rows: `border-l-2 border-black` or `border-l-4 border-black`

## Interaction State Patterns

Use these patterns consistently.

### Resting State

- `bg-white text-black`
- No enclosing border

### Hover State

- Do not use hover styles.
- Components should remain legible and understandable without pointer hover feedback.

### Active / Pressed State

- Primary pattern: invert the control
- Use `bg-black text-white`
- No animated press effects

### Focus State

- Use a clear black outline
- Prefer `focus-visible:outline-2 focus-visible:outline-black`
- Add `focus-visible:outline-offset-2` when separation from the component edge improves clarity
- Do not use glow, blur, shadow, or colored focus effects

### Selected State

- Use one or more of the following:
  - `font-bold`
  - `border-l-2 border-black`
  - `border-l-4 border-black`
  - `bg-black text-white` for segmented or toggle controls

### Disabled State

- Use reduced opacity, typically `opacity-25`
- Keep labels readable enough to identify the unavailable control
- Do not use color shift alone

### Secondary / De-Emphasized State

- Use `italic` or reduced opacity such as `opacity-60`
- Do not use this treatment for warnings or required actions

## Component Defaults

### Buttons

- Primary button: `min-h-11 px-3 py-2 bg-black text-white`
- Icon button: `min-h-11 min-w-11 bg-transparent text-black`
- Active button state: `bg-black text-white`
- Button text should use `text-base` or `text-lg`

### Lists And Menus

- Rows should default to `bg-white text-black`
- Keep rows at `min-h-11`
- Use `px-3 py-2` for normal density
- Use `px-3 py-1` for denser rows
- Mark selection with `font-bold` plus a left rule where helpful

### Panels And Regions

- Use flat white surfaces
- Separate sections with top or bottom rules, not enclosing borders
- Prefer `p-3`, `p-4`, or `p-6` with `space-y-4` or `space-y-6`

### Inputs

- Inputs should use `bg-white text-black`
- Borderless inputs are acceptable if the surrounding layout already defines the control area
- Focus must still use the standard black outline treatment
- Textareas and search fields should keep at least `min-h-11`

### Code, Logs, And Diffs

- Use the monospace font family
- Prefer structural separation and weight over syntax color
- Use rules and spacing to separate code-related sections
- Any accent fills used in diffs must remain understandable in grayscale

## Non-Goals

- No glass effects
- No soft shadow card systems
- No hover-driven interaction model
- No animation-driven feedback
- No color-dependent semantic system
- No low-contrast aesthetic mode

## Implementation Checklist

- Verify the screen in grayscale
- Verify focus states with keyboard navigation
- Verify selected states without relying on color
- Verify active states use inversion or a structural change
- Verify all major controls meet the `min-h-11` target when practical
- Verify body text uses Tailwind's scale consistently
- Verify spacing uses Tailwind increments only
- Verify responsive changes preserve the same e-ink visual language
