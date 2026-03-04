# QuantVN Design System: Editorial Fintech

## Design Philosophy

**Core Concept**: A financial publication aesthetic that combines the authority and trustworthiness of traditional financial journalism (Bloomberg, Financial Times, Wall Street Journal) with modern web functionality. The design treats financial data as editorial content — worthy of beautiful typography, considered spacing, and print-quality presentation.

**Differentiation**: Unlike typical fintech apps that feel like dashboards or trading terminals, QuantVN feels like reading a sophisticated financial publication. Data is presented with editorial hierarchy, not just crammed into cards and tables.

---

## Visual Identity

### Typography System

```
┌─────────────────────────────────────────────────────────────┐
│  HEADLINES & DISPLAY                                        │
│  Font: Serif (Georgia, "Times New Roman", system serif)     │
│  Style: Bold, authoritative, dramatic scale                 │
│  Usage: Page titles, section headers, key metrics           │
│                                                              │
│  Example: font-serif text-5xl font-bold tracking-tight      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  BODY & UI TEXT                                              │
│  Font: Sans-serif (system-ui, Inter alternative)            │
│  Style: Clean, readable, functional                         │
│  Usage: Paragraphs, descriptions, UI labels, buttons        │
│                                                              │
│  Example: font-sans text-sm text-stone-600                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  LABELS & METADATA                                           │
│  Font: Sans-serif, uppercase                                │
│  Style: Small, tracked, muted                               │
│  Usage: Section labels, categories, timestamps              │
│                                                              │
│  Example: text-xs uppercase tracking-[0.15em] text-stone-500│
└─────────────────────────────────────────────────────────────┘
```

### Color Palette

```
LIGHT MODE
═══════════════════════════════════════════════════════════════

Backgrounds (Paper tones - warm, not pure white)
├── Primary:    stone-50     #fafaf9  (Main background)
├── Secondary:  stone-100    #f5f5f4  (Alternate sections)
├── Cards:      white        #ffffff  (Content cards)
└── Accent bg:  emerald-50   #ecfdf5  (Highlights)

Text (Ink tones - rich blacks, not pure)
├── Primary:    stone-900    #1c1917  (Headlines, key text)
├── Secondary:  stone-600    #57534e  (Body text)
├── Muted:      stone-500    #78716c  (Labels, metadata)
└── Disabled:   stone-400    #a8a29e  (Inactive elements)

Accent (Emerald - financial growth, prosperity)
├── Primary:    emerald-700  #047857  (Main accent)
├── Hover:      emerald-800  #065f46  (Interactive states)
├── Light:      emerald-600  #059669  (Secondary accent)
└── Subtle:     emerald-100  #d1fae5  (Backgrounds)

Borders
├── Light:      stone-200    #e7e5e4  (Subtle divisions)
├── Medium:     stone-300    #d6d3d1  (Clear boundaries)
└── Dark:       stone-900    #1c1917  (Emphasis)

DARK MODE
═══════════════════════════════════════════════════════════════

Backgrounds
├── Primary:    neutral-950  #0a0a0a  (Main background)
├── Secondary:  neutral-900  #171717  (Alternate sections)
├── Cards:      neutral-900  #171717  (Content cards)
└── Accent bg:  emerald-950  #022c22  (Highlights)

Text
├── Primary:    white        #ffffff  (Headlines)
├── Secondary:  neutral-400  #a3a3a3  (Body text)
├── Muted:      neutral-500  #737373  (Labels)
└── Disabled:   neutral-600  #525252  (Inactive)

Accent
├── Primary:    emerald-400  #34d399  (Main accent)
├── Hover:      emerald-300  #6ee7b7  (Interactive)
└── Subtle:     emerald-900  #064e3b  (Backgrounds)

Borders
├── Light:      neutral-800  #262626  (Subtle)
├── Medium:     neutral-700  #404040  (Standard)
└── Accent:     emerald-600  #059669  (Emphasis)
```

### Spacing & Layout

```
CONTAINER WIDTHS
├── Content:    max-w-6xl (1152px) - Main content
├── Narrow:     max-w-4xl (896px)  - Focused content
├── Wide:       max-w-7xl (1280px) - Full-width sections

SECTION SPACING
├── Padding Y:  py-20 (5rem) - Section vertical
├── Padding X:  px-6 (1.5rem) - Mobile horizontal
├── Padding X:  lg:px-8 (2rem) - Desktop horizontal

GRID SYSTEM
├── 2-column:   grid md:grid-cols-2
├── 3-column:   grid lg:grid-cols-3
├── 4-column:   grid lg:grid-cols-4
├── Gap:        gap-8 to gap-12

EDITORIAL DIVIDERS
├── Section:    border-b border-stone-200 dark:border-neutral-800
├── Accent:     h-1 bg-emerald-700 (Top of page/nav)
├── Subtle:     h-px (Hairline rules)
```

---

## Component Patterns

### Section Header (Editorial Style)

```tsx
// Pattern: Newspaper section header
<div className="mb-12 pb-6 border-b border-stone-200 dark:border-neutral-800">
  {/* Kicker - small label above headline */}
  <div className="flex items-center gap-3 mb-4">
    <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
    <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
      Section Label
    </span>
  </div>

  {/* Headline - serif, dramatic */}
  <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
    Main Headline
    <br />
    <span className="text-emerald-700 dark:text-emerald-400">Accent Words</span>
  </h2>
</div>
```

### Data Card (Financial Publication Style)

```tsx
// Pattern: Financial data presentation
<div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
  {/* Label */}
  <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-4 pb-2 border-b border-stone-100 dark:border-neutral-800">
    Metric Label
  </div>

  {/* Value - large serif */}
  <div className="font-serif text-3xl font-bold text-stone-900 dark:text-white">
    +24.7%
  </div>

  {/* Context - smaller sans */}
  <div className="font-sans text-sm text-stone-500 dark:text-neutral-400 mt-1">
    Year to date
  </div>
</div>
```

### Grid Divider Pattern

```tsx
// Pattern: Newspaper column grid with borders
<div className="grid md:grid-cols-2 gap-px bg-stone-200 dark:bg-neutral-700">
  {items.map((item) => (
    <div className="bg-white dark:bg-neutral-950 p-8 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors">
      {/* Content */}
    </div>
  ))}
</div>
```

### Button Styles

```tsx
// Primary - Solid
className="px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-sans font-semibold text-sm uppercase tracking-wider hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"

// Secondary - Outline
className="px-6 py-3 border-2 border-stone-900 dark:border-white text-stone-900 dark:text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-stone-900 dark:hover:bg-white hover:text-white dark:hover:text-stone-900 transition-colors"

// Accent - Emerald
className="px-6 py-3 bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
```

### Stats Display

```tsx
// Pattern: Key metrics row
<div className="flex items-baseline justify-between py-2 border-b border-stone-100 dark:border-neutral-800">
  <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">Label</span>
  <span className="font-serif text-2xl font-bold text-stone-900 dark:text-white">Value</span>
</div>
```

---

## Animation & Interaction

### Transitions

```css
/* Standard transition */
transition-colors    /* Color changes */
transition-transform /* Scale/movement */
transition-opacity   /* Fade effects */

/* Duration */
duration-300         /* Standard (300ms) */

/* Hover lift effect */
hover:-translate-y-0.5

/* Hover scale */
hover:scale-105
```

### Micro-interactions

```
1. LINK HOVERS
   - Color change: stone-600 → stone-900
   - Arrow translate: translate-x-1

2. CARD HOVERS
   - Background: white → stone-50
   - Border accent: stone-200 → emerald-600
   - Subtle lift: -translate-y-0.5

3. BUTTON HOVERS
   - Background darken/lighten
   - No scale (editorial = refined, not playful)

4. FOCUS STATES
   - Ring-2 ring-emerald-500 ring-offset-2
```

---

## Page Templates

### Landing Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  NAVIGATION                                                 │
│  [Logo] ----------- [Links] -------- [Login] [CTA]         │
├─────────────────────────────────────────────────────────────┤
│  HERO SECTION                                               │
│  ┌─────────────────────┬───────────────────┐               │
│  │ Kicker              │                   │               │
│  │ HEADLINE (serif)    │   Stats Sidebar   │               │
│  │ Subheadline         │   (bordered card) │               │
│  │ [CTA Buttons]       │                   │               │
│  └─────────────────────┴───────────────────┘               │
├─────────────────────────────────────────────────────────────┤
│  FEATURES SECTION                                           │
│  Section Header (kicker + headline)                        │
│  ┌─────────────┬─────────────┐                             │
│  │ 01 Feature  │ 02 Feature  │                             │
│  ├─────────────┼─────────────┤                             │
│  │ 03 Feature  │ 04 Feature  │                             │
│  └─────────────┴─────────────┘                             │
├─────────────────────────────────────────────────────────────┤
│  SOCIAL PROOF                                               │
│  Stats Grid (4 columns)                                    │
│  Academic Quote Block                                       │
├─────────────────────────────────────────────────────────────┤
│  PRICING                                                    │
│  ┌─────────────┬─────────────┐                             │
│  │   FREE      │    PRO      │                             │
│  │   Plan      │   Plan ★    │                             │
│  └─────────────┴─────────────┘                             │
├─────────────────────────────────────────────────────────────┤
│  CTA SECTION                                                │
│  Final headline + CTA button                               │
│  Academic project attribution                              │
├─────────────────────────────────────────────────────────────┤
│  FOOTER                                                     │
│  [Brand] [Links] [Copyright]                               │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (Fixed)          │  MAIN CONTENT                  │
│  ┌────────────┐           │  ┌──────────────────────────┐  │
│  │ Dashboard  │           │  │ Page Header              │  │
│  │ Screener   │           │  │ (Kicker + Title)         │  │
│  │ Backtest   │           │  ├──────────────────────────┤  │
│  │ Portfolio  │           │  │                          │  │
│  │ Charts     │           │  │ Content Area             │  │
│  │ ──────────│           │  │ (Cards/Tables/Charts)    │  │
│  │ Settings   │           │  │                          │  │
│  └────────────┘           │  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Voice & Tone

### Copy Guidelines

```
HEADLINES
- Clear, benefit-focused
- Use sentence case or title case consistently
- Can span multiple lines for dramatic effect
- Example: "Backtest Strategies on Vietnam's Stock Market"

SUBHEADLINES
- One complete thought
- Explain the value, not just the feature
- Example: "Test your strategies against 7 years of historical data"

LABELS
- Short, scannable
- Uppercase with letter-spacing
- Example: "QUICK STATS" not "Quick Statistics"

CTAs
- Action-oriented, specific
- Uppercase with tracking
- Example: "START FREE TRIAL" not "Get Started"

METADATA
- Compact, informative
- Include units where helpful
- Example: "₫199,000/month" not "Price: 199000 VND per month"
```

---

## Accessibility

```
COLOR CONTRAST
- All text meets WCAG AA (4.5:1 for body, 3:1 for large)
- Emerald accents tested on both light and dark backgrounds

FOCUS STATES
- Visible focus rings on all interactive elements
- Ring color: emerald-500 with offset

KEYBOARD NAVIGATION
- All features accessible via keyboard
- Skip links for main content
- Logical tab order

SCREEN READERS
- Semantic HTML (headings, lists, landmarks)
- ARIA labels where needed
- Alt text for all images
```

---

## Implementation Notes

### Tailwind Classes Reference

```css
/* Typography */
.font-serif          /* Headlines */
.font-sans           /* Body/UI */
.tracking-tight      /* Headlines */
.tracking-wider      /* Labels */
.uppercase           /* Labels/CTAs */
.tracking-[0.15em]   /* Editorial labels */

/* Colors */
.bg-stone-50         /* Light background */
.bg-stone-100        /* Alternate sections */
.text-stone-900      /* Primary text */
.text-emerald-700    /* Accent */

/* Borders */
.border-stone-200    /* Light borders */
.gap-px bg-stone-200 /* Grid dividers */

/* Buttons */
.uppercase tracking-wider font-semibold
```

### CSS Variables (Optional Customization)

```css
:root {
  --color-paper: theme('colors.stone.50');
  --color-ink: theme('colors.stone.900');
  --color-accent: theme('colors.emerald.700');
  --font-display: ui-serif, Georgia, serif;
  --font-body: ui-sans-serif, system-ui, sans-serif;
}
```

---

## Prompt for AI Generation

When generating new components or pages in this style, use this prompt:

> Design a component/page for QuantVN using the "Editorial Fintech" design system.
>
> **Typography**: Serif headlines (font-serif, bold, tracking-tight), sans-serif body (font-sans), uppercase tracked labels (text-xs uppercase tracking-[0.15em]).
>
> **Colors**: Warm paper backgrounds (stone-50, stone-100), rich ink text (stone-900), emerald accents (emerald-700). No gradients. Use solid colors with clear borders.
>
> **Layout**: Newspaper-style column grids, gap-px dividers, clear hierarchy with kickers above headlines. Content should feel like a financial publication, not a typical dashboard.
>
> **Components**: Border-defined cards, stats in serif font, editorial section headers with horizontal rules. Buttons use uppercase tracking-wider.
>
> **Dark mode**: stone → neutral, emerald-700 → emerald-400.
>
> **Tone**: Authoritative, refined, trustworthy — like Bloomberg or Financial Times.
