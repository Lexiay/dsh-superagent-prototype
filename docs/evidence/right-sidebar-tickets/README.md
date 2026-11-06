# Right-sidebar Tickets page — before/after captures

Captured for the pull request that adds the Tickets page to DeepSeek Harness's right sidebar
(`feat/right-sidebar-tickets`, commit 22d52af, based on `main` a0ea386).

- Viewport: 1440×900, headless Chromium, system theme, same DSH web profile.
- Scenario: one session open; right sidebar expanded; the guide, then the Tickets tab.
- State: a copied, sanitized demo state; ticket titles are placeholders (`Example ticket`), and the
  captures are cropped to the right sidebar, so no Feishu conversation content or local paths are shown.
- `before-guide.png`: `main` a0ea386 — guide without a Tickets entry.
- `after-guide.png`: branch 22d52af — guide with the Tickets entry.
- `after-tab.png`: branch 22d52af — Tickets tab (Open filter, empty list).
