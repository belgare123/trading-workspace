## Variant: Glass Morphic

### Design stance
Frosted glass surfaces with subtle backlight glow and cyan-green accent palette. Creates depth through layered transparency and backdrop blur.

### Key choices
- **Layout**: Same as reference — left sidebar, center chart + table, right inspector
- **Typography**: Inter (display) + JetBrains Mono (data)
- **Color**: Deep #07080b background, glass panels with rgba(255,255,255,0.03) and 24px blur
- **Interaction**: Pulse dot animation on live events, glow on hover, gradient fills on bars

### Trade-offs
- **Strong at**: Premium feel, depth perception, modern aesthetic
- **Weak at**: Readability on very small screens, performance on low-end GPUs (blur)

### Best for
Users who want a futuristic, glowing interface — hedge fund / prop trading visual language
