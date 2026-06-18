## Epiphany — design system conventions

**No wrapper/provider needed.** Components are plain function components — no ThemeProvider, no context required to render.

**Styling idiom: inline styles + a `dark`/`t` theme prop, not utility classes.** This DS has no class vocabulary (no Tailwind, no CSS modules) and only a handful of CSS custom properties (`--font-primary`, `--text-*`, `--space-*`, `--radius`, `--shadow-*` — see `tokens/design-tokens.css`). Components take a boolean `dark` prop and/or a `t` prop (translation/theme object) to switch appearance — pass these explicitly rather than wrapping in a theme provider. Animations are injected globally via a `<style>` tag the first component mounted appends to `document.head` (keyframes: `blink`, `pulse`, `spin`, `scroll`) — reuse those keyframe names rather than inventing new ones.

**Where the truth lives.** `tokens/design-tokens.css` for spacing/type/radius tokens; each component's own inline `style` objects are the actual source of color/layout — read the component source for real values, the tokens file is sparse.

**Build snippet:**
```jsx
import { Card, BlinkingDot, StatusBar } from '<pkg>';

<Card dark={false}>
  <BlinkingDot color="#3ddc84" speed={1.5} />
  <StatusBar t={translations} reliability={0.98} />
</Card>
```

Brand font is Apple's SF Pro (Display/Text) — not shipped (Apple-licensed); the bundle falls back to `-apple-system, system-ui, sans-serif`, which renders close enough on Apple platforms.
