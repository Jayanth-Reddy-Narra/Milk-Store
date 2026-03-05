# Brand Guidelines: Reddyagency

## Brand Summary
Reddyagency is a premium, matte-black themed business management tool specifically designed for small business milk shop owners. The goal is a mobile-first, practical, and fast experience that focuses on utility without unnecessary fluff, keeping everything sleek, modern, and high-contrast.

## Selected Name and Tagline
**Name:** Reddyagency
**Tagline:** Your dairy business, streamlined.

*Other Options:* MilkyWay Tracker, PurePour, DairyDash, WhiteGold Manager
*Other Taglines:* Track every drop, maximize your profit. | The simplest way to run your milk store.

## Color System (with hex)
- **Background Primary:** `#121212` (Matte Black)
- **Background Secondary (Cards/Modals):** `#1E1E1E`
- **Surface Hover/Active:** `#2C2C2C`
- **Text Primary:** `#F3F4F6` (Off-White)
- **Text Secondary:** `#9CA3AF` (Muted Gray)
- **Brand Accent:** `#FDE047` (Bright Dairy Yellow - use sparingly for primary actions)
- **Success:** `#22C55E` (Green)
- **Danger/Error:** `#EF4444` (Red)
- **Border/Divider:** `#374151`

## Typography
- **Font Family:** System Font Stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`)
- **Headings:** Bold, clear, tight letter-spacing (Base: 1.5rem to 2rem)
- **Body:** Regular weight, high legibility (Base: 1rem)
- **Small/Muted:** (Base: 0.875rem)
- **Line Height:** 1.5 for body, 1.2 for headings.

## Spacing + Layout
- **Base Unit:** 4px
- **Padding/Margin Scale:** `4px (xs)`, `8px (sm)`, `16px (md)`, `24px (lg)`, `32px (xl)`
- **Container Max-Width:** 1200px (Desktop), Full width (Mobile)
- **Border Radius:** `8px (md)` for cards and buttons, `12px (lg)` for modals.
- **Flex/Grid Gaps:** Default `16px`.

## Components
- **Buttons:** 
  - Primary: Brand Accent background, Black text, bold, no border, medium border-radius.
  - Secondary: Transparent background, white text, 1px solid Border color.
- **Cards:** Secondary background, thin border (Border/Divider color), no box-shadow to keep it flat and matte.
- **Inputs:** Darker background (`#121212`), white text, 1px solid Border color, focus state uses Accent color border.
- **Modals:** Centered, semi-transparent black overlay (`rgba(0,0,0,0.8)`), Secondary background container.

## Iconography
- Line-style icons.
- Thickness: 2px.
- Use simple, universally understood metaphors (e.g., box for inventory, cart for checkout, chart for reports).
- Keep sizes consistent at `24x24px`.

## Motion
- Fast, subtle, and snappy.
- Transition duration: `150ms` or `200ms`.
- Easing: `ease-in-out` or `cubic-bezier(0.4, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion` to disable all transitions.
- Examples: Button hover background changes, modal fade-ins.

## Accessibility Checklist
- [x] High contrast ratio (WCAG AA pass for all text).
- [x] Visible focus rings for keyboard navigation (`outline: 2px solid var(--accent); outline-offset: 2px;`).
- [x] Semantic HTML elements (nav, main, section, aside, button vs a).
- [x] ARIA labels on icon-only buttons.
- [x] Disable motion via media query `(prefers-reduced-motion: reduce)`.

## CSS Variables Block
```css
:root {
  --bg-primary: #121212;
  --bg-secondary: #1E1E1E;
  --bg-hover: #2C2C2C;
  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --brand-accent: #FDE047;
  --text-accent: #121212;
  --success: #22C55E;
  --danger: #EF4444;
  --border-color: #374151;
  --radius-md: 8px;
  --radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --transition-fast: 150ms ease-in-out;
}
```

## JSON Token Object
```json
{
  "colors": {
    "background": {
      "primary": "#121212",
      "secondary": "#1E1E1E",
      "hover": "#2C2C2C"
    },
    "text": {
      "primary": "#F3F4F6",
      "secondary": "#9CA3AF",
      "accent": "#121212"
    },
    "brand": {
      "accent": "#FDE047",
      "success": "#22C55E",
      "danger": "#EF4444"
    },
    "border": "#374151"
  },
  "radii": {
    "md": "8px",
    "lg": "12px"
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px"
  },
  "motion": {
    "fast": "150ms ease-in-out"
  }
}
```