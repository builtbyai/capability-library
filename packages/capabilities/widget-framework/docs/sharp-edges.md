# widget-framework · sharp edges

## 1. react-grid-layout vs react-rnd both have collision bugs

Per dashboard_v5 history: react-grid-layout has cleaner persistence but its onResizeStop has a known race with controlled state. react-rnd avoids that but doesn't snap. Pick one and stick with it; mixing breaks layouts.

## 2. Mobile breakpoint is NOT just CSS

Below 768px the grid collapses to a single column with reordering. That requires storing a `mobileLayout` alongside the desktop layout — not just media queries. Initial dashboard_v5 builds shipped without this and lost user customization on mobile.

## 3. CommandPalette + global keyboard shortcuts collide

Cmd/Ctrl+K is the canonical palette key but is also Chrome address-bar focus. Use Cmd/Ctrl+Shift+P (VS Code convention) to avoid the conflict, with Cmd+K as a fallback that preventDefault's only when the focus is on a Widget element.

## 4. LocalStorage layout vs server layout

On a new device, the cap MUST hydrate from server, not blank. The user got bit when localStorage was the only source and a new browser showed an empty grid. Always server-first; localStorage is a cache.

## 5. Notifications stack stale on rapid-fire emit

If 50 widgets emit notifications during a sync, the toast container grows unbounded. Cap at 5 visible; older toasts collapse into an "N more" indicator.

