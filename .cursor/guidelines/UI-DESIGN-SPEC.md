# UI DESIGN SPEC - AI AGENT INSTRUCTIONS

**SAVE AS: `UI-DESIGN-SPEC.md`**  
**Purpose**: Single source of truth for all UI generation. Read this file before creating ANY TSX components.

---

## 🎨 1. DESIGN TOKENS (MANDATORY)

**Colors** (use EXACT hex codes):
```
Primary:    #3B82F6 (blue-500)
Secondary:  #6B7280 (gray-500) 
Success:    #10B981 (green-500)
Error:      #EF4444 (red-500)
Background: #FFFFFF (white)
Surface:    #F9FAFB (gray-50)
```

**Spacing** (8pt system - 0.25rem increments):
```
xs: 0.25rem (4px)  - padding inside buttons
sm: 0.5rem  (8px)  - gaps between small elements
md: 1rem    (16px) - card padding, section gaps
lg: 1.5rem  (24px) - container padding
xl: 2rem    (32px) - hero sections
```

**Typography Scale**:
```
xs: 0.75rem  - captions
sm: 0.875rem - body text
base: 1rem   - default
lg: 1.125rem - card titles
xl: 1.5rem   - section headers
2xl: 2rem    - page titles
```

**Border Radius**:
```
sm: 0.375rem (6px)
md: 0.5rem   (8px)  - buttons, cards
lg: 0.75rem  (12px) - modals
```

---

## 📱 2. MOBILE-FIRST LAYOUT SYSTEM

**EVERY screen follows this progression**:

```
MOBILE (0-767px)
├── Container: max-w-md mx-auto p-6
├── Layout: flex-col gap-4
├── Nav: hidden → drawer (hamburger)
└── Touch targets: min 44x44px

TABLET (768-1023px)  
├── Container: max-w-4xl mx-auto p-8
├── Layout: grid-cols-2 gap-6
├── Nav: flex-row visible
└── Cards expand 33% wider

DESKTOP (1024px+)
├── Container: max-w-7xl mx-auto p-12  
├── Layout: grid-cols-3 lg:grid-cols-4 gap-8
├── Nav: sticky sidebar
└── Cards: max-content width
```

---

## 🧩 3. REQUIRED COMPONENTS

**Button** (ALL buttons must match):
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

<button className={`
  ${variant === 'primary' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-200 hover:bg-gray-300'}
  ${size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-3 text-lg' : 'px-4 py-2 text-sm'}
  rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
`}>
  {children}
</button>
```

**Card** (ALL cards must match):
```tsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
  <div className="space-y-3">{children}</div>
</div>
```

---

## ♿ 4. ACCESSIBILITY (NON-NEGOTIABLE)

**Every interactive element MUST HAVE**:
```
✅ role="button" OR native <button>
✅ aria-label OR visible text  
✅ focus-visible:ring-2 ring-blue-500
✅ keyboard-navigable (tabindex if needed)
✅ screen reader friendly (semantic HTML)
✅ color contrast ≥ 4.5:1 (WCAG AA)
```

---

## 📋 5. COMMON SCREENS

**Dashboard Layout**:
```
Hero section (h1 + metrics row)
├── Grid of MetricCards (3-col desktop)
├── Recent Activity table/feed
└── Sidebar nav (desktop only)
```

**User Profile**:
```
Avatar (left) + User info (right)
├── Email input + Edit button
├── Role selector + Save button
└── Delete account (destructive, confirmation)
```

**Form Pattern**:
```
Label above input (NOT placeholder)
Helper text below
Error message (red, inline)
Loading spinner on submit
Success message on completion
```

---

## 🔄 6. AI AGENT WORKFLOW

**MANDATORY DELIVERABLES** (every UI task):

```
1. [ ] Component.tsx (fully typed)
2. [ ] Component.stories.tsx (3 variants: default/mobile/dark)
3. [ ] Component.test.tsx (Vitest - RTL queries)  
4. [ ] e2e.spec.ts (Playwright - mobile + desktop)
5. [ ] Updated this UI-DESIGN-SPEC.md (if tokens change)
```

**Prompt Template**:
```
"Create [COMPONENT] following UI-DESIGN-SPEC.md exactly.

Use:
- Design tokens from section 1
- Mobile-first layout from section 2  
- Component patterns from section 3
- Accessibility from section 4

Deliver all 5 files above."
```

---

## ✅ CHECKLIST FOR EVERY COMPONENT

- [ ] Uses exact tokens (no magic numbers)
- [ ] Mobile-first (stacked → grid progression)  
- [ ] Button/Card patterns match examples
- [ ] ARIA labels + focus rings
- [ ] Responsive breakpoints (md: lg:)
- [ ] Storybook story with args
- [ ] Vitest test with getByRole()
- [ ] Playwright test (mobile + desktop)

---

**This file = YOUR DESIGN SYSTEM.** Version it in git. Update tokens here → ALL UI stays consistent.


**Save as `UI-DESIGN-SPEC.md` in your repo root.** Every AI agent reads this first. Zero UI skills needed. Perfect TSX every time.[1]

Sources
[1] README.md - rhwilr/markdown-documentation-template - GitHub https://github.com/rhwilr/markdown-documentation-template/blob/master/README.md
[2] Top-Notch UI/UX for Documentation on the Web? : r/UXDesign https://www.reddit.com/r/UXDesign/comments/1nush9h/topnotch_uiux_for_documentation_on_the_web/
[3] GitHub - jmrecodes/GenAI-UI-UX-Markdowns: Web Design Brief markdown files to be used as a reference for genAIs for code generation designing apps adhering to globally considered UI/UX standards. https://github.com/jmrecodes/GenAI-UI-UX-Markdowns
[4] imayobrown/DesignDocumentTemplates: Light weight design ... https://github.com/imayobrown/DesignDocumentTemplates
[5] Markdown Templates - bimdonity https://bimdonity.ch/About/Contribute/mk100-1001_markdown-templates/
[6] How to use Markdown for writing documentation - Experience Leagueexperienceleague.adobe.com › docs › contributor-guide › writing-essentials https://experienceleague.adobe.com/en/docs/contributor/contributor-guide/writing-essentials/markdown
[7] Markdown style guide | styleguide - Google https://google.github.io/styleguide/docguide/style.html
[8] Markdown designs, themes, templates and downloadable ... - Dribbble https://dribbble.com/tags/markdown
[9] Chapter 17 Document Templates | R Markdown: The Definitive Guide https://yihui.org/rmarkdown/document-templates
[10] Basic Syntax https://www.markdownguide.org/basic-syntax/
