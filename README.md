# Intune RBAC Designer

A local, zero-install app for designing Microsoft Intune custom RBAC roles. Run the Windows exe, or open `index.html` in any browser — no server, no installer, no accounts.

Built for Intune admins who need to think through role permissions before committing them in the portal, share designs with teammates, or document what each role actually does.

![The role editor: roles in folders on the left, and the permissions of the open role on the right](docs/screenshots/overview-light.png)

**On this page:** [Download](#download-for-windows) · [Getting started](#getting-started) · [What it does](#what-it-does) · [Working with your Intune tenant](#working-with-your-intune-tenant) · [Building the Windows app](#building-the-windows-app)

## Download for Windows

1. Go to the [latest release](https://github.com/Michael-Civitillo/intune-rbac-designer/releases/latest) and download **Intune-RBAC-Designer-…-win-x64.exe**.
2. Double-click it. That's it — nothing is installed and you don't need admin rights.

Good to know:

- **Starting takes 10–15 seconds.** The exe is a single portable file that unpacks itself each time it starts; a small "Starting…" window shows while it does.
- **Windows may warn you.** The app isn't code signed, so SmartScreen can show "Windows protected your PC". Choose **More info**, then **Run anyway**. Some organizations block unsigned apps entirely; if yours does, use the browser version below.
- **Your work is kept.** Roles are saved on your PC (under `%APPDATA%\Intune RBAC Designer`) and are there the next time you open the app, even if you move or re-download the exe.
- **Exports go to Downloads**, and the file is highlighted in Explorer when it's ready.
- **It stays offline.** The app makes no network connections.
- Windows 10 or 11, 64-bit.

---

## Getting started

1. **Start the app.** Run the [Windows exe](#download-for-windows), or download this repo and open `index.html` in Chrome, Edge or Safari. There is no `npm install`, no config and no account.
2. **Create a role.** Click **New Role** for a blank one. The arrow next to it has two shortcuts: **From a built-in role** copies one of Microsoft's roles for you to trim down, and **Import from a file** brings in a backup or roles exported from Intune.
3. **Name it and say what it's for.** The name and a short description go at the top of the role. To group roles, make folders such as *Service desk* or *Windows* with the folder button next to **New Role**, then drag roles into them.
4. **Tick the permissions it needs.** Click anywhere on a permission to tick it. Press `/` to search, and switch **All** to **Selected** to see only what the role grants.
5. **Read the markers under the role's name.** **to check** lists likely mistakes, most with a one-click fix. **new** lists permissions Microsoft has added since you last reviewed the role.
6. **Plan who gets it.** On the **Assignments** tab, record the admin groups, scope groups and scope tags.
7. **Share it.** **Export Excel** makes a workbook, **Compare Image** makes a picture of every role side by side, and **Create in Intune** writes a script that builds the role in your tenant.
8. **Keep a copy.** **Backup and Import** saves everything to one file, and reads it back in on any PC.

Everything is saved automatically as you go.

---

## What it does

### Build a role

**Design roles visually** — Browse all 53 Intune permission categories (pulled from Microsoft Learn), check off the exact permissions each role needs, and see a live count as you go.

**Start from a built-in role** — Open the arrow next to **New Role** and pick one of Microsoft's nine built-in roles (Help Desk Operator, Read Only Operator, and so on). You get an editable copy with the same permissions, ready to trim down.

<p align="center"><img src="docs/screenshots/built-in-roles.png" width="720" alt="Picking one of Microsoft's nine built-in roles as a starting point"></p>

**Describe and justify it** — Give each role a description, and add a note to any granted permission saying why the role needs it. Both travel with the summary and the Excel export, which makes change requests easier.

**Plan the assignments** — The **Assignments** tab records who would get the role and over what: Admin Groups, Scope (Groups) and Scope (Tags), named the way Intune's assignment wizard names them. A role can have several.

![The Assignments tab, with admin groups, scope groups and scope tags for each planned assignment](docs/screenshots/assignments.png)

**Organize with folders** — Group roles by team (Windows, macOS, Mobile, Security, etc.). Drag roles between folders or drop them into "No Folder" to reorganize on the fly. Hover a folder to add a role to it, rename it, or delete it.

**Descriptions right in the list** — Every permission shows Microsoft's description under its name, and clicking anywhere on a row ticks it. Long descriptions fold to three lines with a **Show more**. Prefer a denser list? Switch **Descriptions** off and hover a permission to read its description in a tooltip instead.

**Search and filter** — Search matches permission names, descriptions and category names, highlights what it found, and opens the matching categories for you. Press `/` to jump to the search box and `Esc` to clear it. Switch from **All** to **Selected** to review just what a role grants.

![Searching for "password": matches are highlighted in permission names and descriptions across every category](docs/screenshots/search.png)

**Clone roles** — Duplicate an existing role as a starting point instead of building from scratch.

### Review it

**Checks** — The app points out likely mistakes: permissions to change something without the Read that lets an admin open it, requirements Microsoft states outright (for example, remote actions also need visibility of devices), roles that can change role assignments, deprecated permissions, half-finished assignments, and permissions saved by a newer version of the app that this one doesn't recognise. A pill on the role shows the count, most findings have a one-click fix, and nothing is ever blocked.

<p align="center"><img src="docs/screenshots/checks.png" width="640" alt="The checks for a role: two warnings, one with a one-click fix, and a note about high-impact permissions"></p>

**See what's new** — When Microsoft adds permissions, roles designed before then show a **New** marker with a filter for just those permissions. Decide whether the role needs them, then choose **Mark as reviewed**.

![The New filter, showing the two permissions Microsoft added since the role was last reviewed](docs/screenshots/whats-new.png)

**Compare roles** — Pick two or more roles and see them side by side, with a switch to show only where they differ. The comparison can be saved as an image.

![Three roles compared side by side, showing only the permissions where they differ](docs/screenshots/compare.png)

**Who has a permission?** — Flip the question round: search for a permission such as *Wipe* and see every role that grants it. Click a role to open it at that exact permission.

<p align="center"><img src="docs/screenshots/who-has.png" width="720" alt="A search for lock, listing each matching permission and the roles that grant it"></p>

**Role summary** — Hit **Summary** on any role to get a quick overview: how many permissions are selected, how many categories they span, how many are high impact, plus the notes, checks and planned assignments.

<p align="center"><img src="docs/screenshots/summary.png" width="560" alt="The summary of a role: permission, category and high-impact counts, then the selected permissions by category"></p>

### Share it and keep it

**Undo instead of "Are you sure?"** — Deleting a role or folder happens straight away, with an **Undo** button in the notification that puts it back exactly where it was.

**Export to Excel** — One workbook, one sheet per role, plus a summary sheet and a sheet of planned assignments. Selected permissions are highlighted green and carry their notes. Ready to share with your team or attach to a change request.

**Export comparison image** — Generate a side-by-side PNG of all roles showing which permissions each one has selected. Useful for reviews and documentation.

**Backup and restore** — **Backup and Import** saves everything to one file, and brings a file back in either alongside your current roles or in place of them. Use it to move between PCs or hand a design to a colleague. A file is checked as it is read: anything in it the app can't understand is skipped and reported, never quietly dropped.

<p align="center"><img src="docs/screenshots/backup-import.png" width="720" alt="Backup and Import, after choosing a backup file: the app says what is in it and offers to add or replace"></p>

**Create the role in Intune** — **Create in Intune** writes a PowerShell script, or the JSON for Microsoft Graph, that creates the role for you. It can also bring in the roles that already exist in your tenant. Both need Intune's internal permission IDs, which the app learns once from your tenant; see [Working with your Intune tenant](#working-with-your-intune-tenant).

<p align="center"><img src="docs/screenshots/create-in-intune.png" width="720" alt="Create in Intune: a PowerShell script that creates the role, with the planned assignments listed as comments"></p>

### Everyday comforts

**Resizable sidebar** — Drag the right edge of the sidebar to make the role column wider or narrower. Long role names and folder names display in full at whatever width you choose. The width is remembered between sessions; double-click the edge to reset it.

**High-impact permission guardrail** — Permissions like *Wipe*, *Retire*, *Reset passcode*, *Delete* on managed devices, and both Remote Help *unattended control* permissions carry a **High impact** badge. When you grant one, the app asks you to confirm before it's added. If you're sure you want to keep moving fast, tick "Don't show this warning again in this window" and the prompt is suppressed for the rest of the session.

<p align="center"><img src="docs/screenshots/destructive-warning.png" width="480" alt="The confirmation shown before a high-impact permission such as Wipe is added"></p>

**Dark mode** — Follows your system setting, including when it changes while the app is open, until you pick a theme yourself with the button at the top of the sidebar.

![The same editor in dark mode](docs/screenshots/dark-mode.png)

**Keyboard and small screens** — Roles, folders, categories and checkboxes are all reachable from the keyboard. On a narrow window the role list tucks into a slide-out panel.

**Persists locally** — Everything saves automatically on your own machine. Your roles are there next time you open the app.

---

## How it works

Everything is vanilla HTML, CSS, and JavaScript. No frameworks, no build pipeline.

| File | What it does |
|---|---|
| `index.html` | App shell and layout |
| `styles.css` | Full token-based theming (light + dark) |
| `app.js` | All app logic — state, rendering, drag-and-drop |
| `permissions.js` | All 53 Intune permission categories and descriptions |
| `built-in-roles.js` | Microsoft's nine built-in roles, used as starting points |
| `assignments.js` | The Assignments tab |
| `checks.js` | The sanity checks and their rules |
| `review.js` | Summary, built-in role picker, compare view, "who has a permission?" |
| `data.js` | Backup and restore, and the Intune export and import |
| `export-excel.js` | Excel export via SheetJS |
| `export-image.js` | Comparison PNG via html2canvas |
| `vendor/` | SheetJS and html2canvas, bundled so everything works offline |
| `desktop/main.js` | The Windows app's shell: a window around the same page |

The only dependencies are SheetJS and html2canvas. Both are checked in under `vendor/` (versions, licenses and checksums are in `vendor/README.md`), so nothing is loaded from a CDN and exports work offline.

The screenshots on this page are taken from made-up sample roles by `scripts/readme-screenshots.js`. After changing the UI, run it again to retake them all (it needs [Playwright](https://playwright.dev/) with Chromium).

---

## Building the Windows app

The exe is the same page wrapped in [Electron](https://www.electronjs.org/). You don't need to build it yourself: GitHub Actions does it on every push (`.github/workflows/windows-app.yml`), tests the result on a real Windows machine, and attaches the exe to the run under **Artifacts**.

**To publish a release**, no git is needed:

1. On GitHub, open **Actions → Windows app → Run workflow**.
2. Type the version, for example `1.1.0`, and run it.

A few minutes later the tested exe and its checksum are on a new release page, tagged `v1.1.0`. Pushing a tag does the same thing, if you prefer:

```
git tag v1.1.0
git push origin v1.1.0
```

To build locally on Windows instead (Node.js 22 or newer):

```
npm ci
npm run dist        # writes dist/Intune-RBAC-Designer-<version>-win-x64.exe
npm start           # or just run the app without packaging it
```

The exe is unsigned. To remove the SmartScreen warning it needs a code-signing certificate, which electron-builder can use once you have one.

---

## Permissions data

The `permissions.js` file contains all Intune custom role permission scopes pulled directly from the Microsoft Learn documentation. Categories include Device Management, Mobile Apps, Managed Devices, Endpoint Security, Policy Sets, and 48 others.

**Last synced with Microsoft Learn: November 2026** (Intune service release 2611) — 255 permissions across 53 categories. Changes picked up in that sync:

- **Android Enterprise** — new *Manage zero touch enrollment* permission (2607). Access to the Google zero-touch portal no longer needs *Update app sync*.
- **Android Enterprise** — *Enrollment time device membership assignment* is now *Enrollment time device membership assignment for Android Enterprise*.
- **Remote Help app** — new *Windows unattended control remote sign-in* permission (2608).
- **Remote Help app** — *Unattended control* is now *Android unattended control*.

Permission names and descriptions are Microsoft's wording, so what you see here is what you'll look for in the Intune admin center. That includes a few quirks in *Remote tasks*, such as the trailing period on *Sync devices.* and *Get FileVault key.*

If Microsoft adds new permissions in a future update, edit `permissions.js` to add them — the rest of the app picks them up automatically. Give each new one an `added: "YYYY-MM-DD"` date and move `CATALOG_DATE` forward, and existing roles will flag it as **New** for review. If Microsoft renames one, add it to `PERMISSION_RENAMES` at the bottom of the same file: roles saved under the old name are carried over to the new one the next time the app loads.

The built-in roles in `built-in-roles.js` come from Microsoft's [built-in role permissions](https://learn.microsoft.com/intune/fundamentals/role-based-access-control/ref-built-in-roles) reference.

---

## Working with your Intune tenant

Intune identifies every permission by an internal ID, and Microsoft doesn't publish those IDs as a list. The app needs them to write a role Intune will accept, and to read roles exported from Intune. Your tenant can list them, and the app only needs that list once.

1. With an account that can read Intune role settings, get the list. In [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer), run a GET request for `https://graph.microsoft.com/beta/deviceManagement/resourceOperations` and copy the response. Or in PowerShell:

   ```
   Connect-MgGraph -Scopes "DeviceManagementRBAC.Read.All"
   Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/beta/deviceManagement/resourceOperations" -OutputType Json | Set-Content resourceOperations.json
   ```

2. In the app, open **Backup and Import** and choose the file, or paste the text. The app matches each entry to its permission by name and tells you how many it matched.

From then on:

- **Create in Intune** on any role gives you a PowerShell script or Graph JSON. The script creates the role definition; assignments are still made in the admin center, and your planned ones are listed in the script as comments.
- To **import existing roles**, export `https://graph.microsoft.com/beta/deviceManagement/roleDefinitions` the same way and bring that file in. You choose which roles to import; they arrive in an "Imported from Intune" folder.

Nothing is sent anywhere by the app itself. It stays offline: you run the Graph requests, and you run the script.

---

## Local storage

Roles and folders are saved to `localStorage` under the key `intuneRbacRoles`. To back up your work or move it to another machine, use **Backup and Import** in the sidebar: it saves one file and reads it back in.

The Windows app and the browser version each keep their own copy; they don't share roles. A backup file is how you move between them.

Data format is versioned — the app handles migrating from older saves automatically.

If saved data ever can't be read, the app says so when it starts, loads everything it can, and sets the original aside instead of overwriting it. **Backup and Import** then offers it back as a file.

---

## License

Released under the [MIT License](LICENSE) © Michael Civitillo.
