# LRVS — Dashboard Overview

A pixel-faithful recreation of the "02 - Dashboard Overview" screen from the LRVS
(Land Record Verification System) reference, built as a static HTML/CSS/JS page.

## Structure

```
lrvs-dashboard/
├── index.html        Markup: sidebar nav, topbar, stat cards, chart panels
├── css/
│   └── style.css      All styling, design tokens as CSS variables, responsive rules
├── js/
│   └── script.js       Chart.js setup for the line + bar charts, range toggle, nav state
└── README.md
```

## Running it

No build step required.

1. Unzip the folder.
2. Open `index.html` directly in a browser, or serve it locally:
   ```
   cd lrvs-dashboard
   python3 -m http.server 8080
   ```
   then visit `http://localhost:8080`.

An internet connection is needed on first load for the Google Font (Inter) and
Chart.js (loaded from cdnjs.cloudflare.com). Everything else is self-contained.

## What's included

- **Sidebar** — brand mark, 7-item nav with active/badge states, org card and
  user profile footer, collapsible on mobile.
- **Topbar** — breadcrumb, search field, "Secure session" pill, notification
  bell with unread dot, avatar.
- **Summary cards** — Pending / In Review / Approved / Rejected, each with a
  tinted icon badge and a trend delta (up/down, colored).
- **Verification Activity** — multi-line area chart (Submitted / Verified /
  Approved) with a working 7 / 30 / 90 day toggle that swaps the dataset.
- **Request Distribution** — bar chart by status plus a matching legend list
  with live counts.

## Customizing

- **Colors / spacing** — all design tokens are CSS variables at the top of
  `css/style.css` (`:root { ... }`) — change once, applies everywhere.
- **Chart data** — edit the `dataSets` object in `js/script.js` to plug in
  real numbers for each date range.
- **Nav items / counts** — edit the `<nav class="nav">` block in `index.html`;
  badges are the `.nav-badge` spans.

## Responsive behavior

- Below 1180px the two chart panels stack vertically.
- Below 800px the sidebar becomes an off-canvas drawer (toggle button provided
  in the brand row) and the search field hides from the topbar.
- Below 520px the stat cards go to a single column.
- Respects `prefers-reduced-motion` and includes visible keyboard focus rings.
