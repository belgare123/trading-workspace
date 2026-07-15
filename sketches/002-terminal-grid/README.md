## Variant: Terminal Grid

### Design stance
Retro-futuristic terminal aesthetic — monospace everything, bracket-style tags, ASCII indicators, grid background.

### Key choices
- **Layout**: Same layout, slightly narrower sidebar and inspector
- **Typography**: JetBrains Mono exclusively — one font for all UI
- **Color**: Dark navy base (#0d1119), cyan/green/red terminal colors
- **Interaction**: Blink animation on live dot (`@keyframes blink`), `[tag]` bracket notation, `❯` prompt in search
- **Details**: `◆` bullets, `▓` logo mark, `//` comment-style section headers

### Trade-offs
- **Strong at**: Developer-first feel, data density, cohesive monospace rhythm
- **Weak at**: Less accessible to non-technical users, limited visual hierarchy

### Best for
Internal trading desk tool, developers who live in terminals, quant teams
