# LeadFlow Design System
## Modern, Polished UI Design Guide

> **Philosophy**: Create a UI that feels premium, intentional, and human-designed. Avoid generic AI-generated aesthetics by focusing on thoughtful details, purposeful animations, and refined visual hierarchy.

---

## 🎨 Core Principles

### Avoid "AI Slop" Aesthetic
- **Typography**: Choose beautiful, unique fonts. Avoid generic fonts like Arial, Inter, Roboto, system fonts. Opt for distinctive choices that elevate aesthetics.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics.
- **Motion**: Use animations for effects and micro-interactions. CSS-only solutions for HTML. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- **Backgrounds**: Create atmosphere and depth. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

### What to Avoid
- ❌ Overused font families (Inter, Roboto, Arial, system fonts)
- ❌ Clichéd color schemes (purple gradients on white backgrounds)
- ❌ Predictable layouts and component patterns
- ❌ Cookie-cutter design that lacks context-specific character

### What to Embrace
- ✅ Creative, distinctive frontends that surprise and delight
- ✅ Unexpected choices that feel genuinely designed for the context
- ✅ Varied aesthetics - don't converge on common choices
- ✅ Think outside the box - avoid convergence on popular choices

---

## 🎨 Color Palette

### Primary Colors
- **Primary**: `hsl(230, 75%, 55%)` - Deep professional blue with slight purple undertone
- **Accent**: `hsl(185, 70%, 48%)` - Vibrant teal/cyan for energy and growth
- **Success**: `hsl(145, 65%, 48%)` - Fresh green
- **Warning**: `hsl(38, 92%, 58%)` - Warm amber
- **Error**: `hsl(0, 72%, 58%)` - Refined red
- **Info**: `hsl(210, 75%, 58%)` - Clear blue

### Neutral Palette
- **Background**: `hsl(240, 10%, 98%)` - Soft, warm whites
- **Card**: `hsl(0, 0%, 100%)` with subtle shadow
- **Border**: `hsl(240, 10%, 88%)` - Subtle, refined borders
- **Text**: `hsl(240, 15%, 10%)` / `hsl(240, 8%, 45%)` / `hsl(240, 5%, 60%)`

**All colors use CSS variables for easy theming.**

---

## 📐 Typography

### Font Stack
Choose distinctive, beautiful fonts. Avoid generic system fonts. Consider:
- Serif options for elegance (when appropriate)
- Geometric sans-serifs with character
- Variable fonts for flexibility
- Fonts that match the brand personality

### Type Scale
**Optimized for older audiences with larger, more readable fonts:**
- **H1**: `2.25rem` (45px) - Page titles
- **H2**: `1.875rem` (37.5px) - Section headers
- **H3**: `1.5rem` (30px) - Subsection headers
- **H4**: `1.25rem` (25px) - Subsection headers
- **Body**: `1.25rem` (20px) - Default body text (increased from 16px)
- **Large**: `1.125rem` (22.5px) - Emphasized text
- **Small**: `0.875rem` (17.5px) - Secondary text (minimum readable size)
- **Extra Small**: `0.75rem` (15px) - Labels and metadata

### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Emphasis
- **Semibold**: 600 - Headings
- **Bold**: 700 - Strong emphasis

---

## 📏 Spacing System

4px base unit:
- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)

---

## 🎭 Component Guidelines

### Cards & Surfaces
- **Elevation**: Subtle shadows (`shadow-soft`, `shadow-soft-lg`)
- **Border Radius**: `0.75rem` (12px)
- **Padding**: Generous (`p-6` minimum)
- **Hover**: Subtle lift with shadow increase

### Buttons
- **Primary**: Solid background, white text
- **Secondary**: Outlined, transparent background
- **Ghost**: Minimal, visible on hover
- **Sizes**: `h-8` (sm), `h-10` (md), `h-12` (lg)
- **Transitions**: Smooth, `duration-200`

### Tables
- **Row Height**: Minimum `3.5rem` (56px)
- **Hover**: Green highlight (`hover:bg-success/8`)
- **Borders**: Clear separation (`border-border/50`)
- **Alternating Rows**: Subtle background variation

### Forms
- **Input Height**: `2.75rem` (44px)
- **Focus**: Colored ring (`ring-primary`)
- **Spacing**: `space-y-6` between groups

---

## ✨ Animation & Motion

### Principles
- **Purpose**: Every animation has a purpose
- **Duration**: `150ms` (quick), `200-300ms` (normal), `400-500ms` (slow)
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` - Smooth, natural

### High-Impact Moments
- Page loads with staggered reveals (`animation-delay`)
- Modal appearances with scale + fade
- Row hover states with color transitions
- Focus on orchestrated moments, not scattered micro-interactions

---

## 🏗️ Layout

### Container
- Max-width `1280px`, centered
- Responsive padding: `px-4 sm:px-6 lg:px-8`

### Spacing Hierarchy
- **Page**: `py-8 lg:py-12`
- **Section**: `mb-8 lg:mb-12`
- **Component**: `mb-4` or `mb-6`
- **Element**: `gap-2` or `gap-4`

---

## 🌓 Dark Mode

- Rich dark backgrounds, not pure black
- Slightly brighter accents for visibility
- More visible borders
- Slightly desaturated colors

---

## ✅ Quality Checklist

- [ ] Distinctive typography (not generic fonts)
- [ ] Cohesive color palette with dominant colors + sharp accents
- [ ] Atmospheric backgrounds (gradients, patterns, depth)
- [ ] High-impact animations (orchestrated, not scattered)
- [ ] No generic "AI slop" aesthetic
- [ ] Creative, unexpected choices
- [ ] WCAG AA contrast ratios
- [ ] Responsive on all breakpoints
- [ ] Smooth animations (no jank)

---

**Remember**: Create distinctive, surprising interfaces. Avoid convergence on common choices. Think outside the box and make creative decisions that feel genuinely designed for LeadFlow.
