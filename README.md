# Intune RBAC Designer

A local, zero-install web app for designing Microsoft Intune custom RBAC roles. Open `index.html` in any browser — no server, no build step, no dependencies to install.

Built for Intune admins who need to think through role permissions before committing them in the portal, share designs with teammates, or document what each role actually does.

---

## What it does

**Design roles visually** — Browse all 53 Intune permission categories (pulled from Microsoft Learn), check off the exact permissions each role needs, and see a live count as you go.

**Organize with folders** — Group roles by team (Windows, macOS, Mobile, Security, etc.). Drag roles between folders or drop them into "No Folder" to reorganize on the fly.

**Hover for descriptions** — Hover any permission to see its full Microsoft description in a tooltip without leaving the screen.

**Role summary** — Hit **Summary** on any role to get a quick overview: how many permissions selected, which categories, and a full breakdown.

**Clone roles** — Duplicate an existing role as a starting point instead of building from scratch.

**Export to Excel** — One workbook, one sheet per role, plus a summary sheet. Selected permissions are highlighted green. Ready to share with your team or attach to a change request.

**Export comparison image** — Generate a side-by-side PNG of all roles showing which permissions each one has selected. Useful for reviews and documentation.

**Resizable sidebar** — Drag the right edge of the sidebar to make the role column wider or narrower. Long role names and folder names display in full at whatever width you choose. The width is remembered between sessions.

**Dark mode** — Follows your system preference and can be toggled manually.

**Persists locally** — Everything saves to `localStorage` automatically. Your roles are there next time you open the file.

---

## Getting started

1. Clone or download this repo
2. Open `index.html` in Chrome, Edge, or Safari
3. Click **New Role** to create your first role
4. Use the folder icon in the sidebar to create team folders
5. When you're ready — export to Excel or grab a comparison image

That's it. No `npm install`, no config, no accounts.

---

## How it works

Everything is vanilla HTML, CSS, and JavaScript. No frameworks, no build pipeline.

| File | What it does |
|---|---|
| `index.html` | App shell and layout |
| `styles.css` | Full token-based theming (light + dark) |
| `app.js` | All app logic — state, rendering, drag-and-drop |
| `permissions.js` | All 53 Intune permission categories and descriptions |
| `export-excel.js` | Excel export via SheetJS |
| `export-image.js` | Comparison PNG via html2canvas |

The only external dependencies are SheetJS and html2canvas, both loaded from CDN. If you're offline, export won't work — everything else does.

---

## Permissions data

The `permissions.js` file contains all Intune custom role permission scopes pulled directly from the Microsoft Learn documentation. Categories include Device Management, Mobile Apps, Managed Devices, Endpoint Security, Policy Sets, and 48 others.

If Microsoft adds new permissions in a future update, edit `permissions.js` to add them — the rest of the app picks them up automatically.

---

## Local storage

Roles and folders are saved to `localStorage` under the key `intuneRbacRoles`. If you want to back up your work or move it to another machine, open DevTools → Application → Local Storage, copy the value, and paste it on the other machine.

Data format is versioned — the app handles migrating from older saves automatically.
