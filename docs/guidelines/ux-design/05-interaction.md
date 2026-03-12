# Interaction, Motion & Feedback

> Motion clarifies relationships and transitions; it must not distract or cause discomfort. Provide instant feedback; respect reduce-motion.

---

## Principles

- Use motion to **clarify spatial relationships and transitions**, not to decorate. Every animation should have a purpose.
- Keep animations **short and purposeful**, with easing that feels natural (not linear).
- Provide **instant visual feedback** on tap/click/press so users never wonder if the system registered the action.
- **Reduce motion**: Avoid motion that may cause motion sickness or vestibular issues. Honour `prefers-reduced-motion: reduce` and provide a reduced or no-motion experience.

*Material Design and Apple HIG both emphasise purposeful motion and user control; WCAG 2.2 addresses animation and flashing content.*

---

## Material Design 3 Motion (Summary)

M3 uses a **physics-based motion system** (M3 Expressive) with springs instead of fixed easing/duration:

- **Motion schemes**: Two presets — **Expressive** (overshoot/bounce, for hero moments and key interactions) and **Standard** (eases to final value, minimal bounce, for utilitarian UIs). Most of the product should use one scheme; swap per element only when emphasising a moment.
- **Springs**: Motion is driven by **stiffness**, **damping**, and **initial velocity**. Spatial movement (position, size, rotation) can overshoot; effects (opacity, colour) should not overshoot.
- **Tokens**: Spring tokens are available (e.g. Jetpack Compose, MDC-Android) for **spatial** vs **effects**, each with **fast**, **default**, and **slow** speeds. Example: fast spatial for small components (buttons, switches); default for partial-screen (bottom sheet, nav rail); slow for full-screen.
- **Application**: Use default scheme for most UI; override with a custom scheme or swap scheme per element only when needed. Components can use the same tokens for consistency across platforms.

*Source: Material Design 3 — Motion (m3.material.io/styles/motion/overview).*

---

## Spring Token Summary

| Type | Use case |
|------|----------|
| **Spatial** | Movement (x, y, rotation, size, corner radius). May overshoot. |
| **Effects** | Opacity, colour. No overshoot. |
| **Fast** | Small components (buttons, switches). |
| **Default** | Partially covering screen (bottom sheet, nav rail). |
| **Slow** | Full-screen transitions, content refresh. |

Implementations (e.g. Compose) map these to spring specs; web can align with equivalent spring/curve values in CSS or JS.

---

## Reduce Motion

- **CSS**: Use `@media (prefers-reduced-motion: reduce)` to shorten or remove animations, or disable parallax/auto-play. Example: `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` or a more targeted approach per component.
- **Content**: Don’t require users to complete time-based tasks that depend on motion (e.g. avoid “wait for animation to finish” to proceed). Provide a skip or static alternative.

*WCAG 2.2 Success Criterion 2.3.3 Animation from Interactions (AAA) and general best practice.*

---

## Feedback Rules

| Situation | Rule |
|-----------|------|
| Button/control press | Immediate visual change (active state, or loading indicator if async) |
| Form submit | Loading state or disable + message; then success or inline error |
| Navigation | Transition should feel quick; avoid long blocking animations |
| Error | Show message inline or in dedicated area; don’t rely only on colour or motion |

---

**Next**: [Forms & Data Input →](06-forms.md)
