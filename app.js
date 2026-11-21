// ── State ─────────────────────────────────────────────────────────────────────
// A role looks like:
//   { id, name, groupId, permissions: Set<permKey>, description, notes: { permKey: text },
//     assignments: [{ id, name, description, adminGroups, scopeGroups, scopeTags }],
//     reviewed: 'YYYY-MM-DD',    // the permission list revision it was last reviewed against
//     unknown: [permKey] }       // saved permissions this version's list doesn't have
let roles             = [];
let groups            = [];   // [{ id, name, collapsed }]
let activeRoleId      = null;
let searchQuery       = '';
let filterMode        = 'all';         // 'all' | 'selected' | 'new'
let editorTab         = 'permissions'; // 'permissions' | 'assignments'
let showDescriptions  = true;
let toastTimer        = null;
let dragState         = null; // { roleId, ghost, sourceEl }
let suppressNextClick = false; // eat the click that follows a completed drag

const STORAGE_KEY   = 'intuneRbacRoles';
const DARK_MODE_KEY = 'intuneRbacDarkMode';
const SHOW_DESC_KEY = 'intuneRbacShowDescriptions';
const SAVE_VERSION  = 3;

const TOTAL_PERMISSIONS = PERMISSIONS_DATA.reduce((n, c) => n + c.permissions.length, 0);
const CLAMP_FROM        = 130; // characters; anything shorter never needs more than three lines

// ── Icons ─────────────────────────────────────────────────────────────────────
function icon(paths, size = 16, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;
}
const ICON = {
  plus:    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  search:  '<circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16.2" y2="16.2"/>',
  x:       '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check:   '<polyline points="20 6 9 17 4 12"/>',
  summary: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>',
  copy:    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  trash:   '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>',
  pencil:  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  alert:   '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info:    '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  layers:  '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  expand:  '<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>',
  collapse:'<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
  note:    '<path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  cloud:   '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/><polyline points="12 12 12 17"/><polyline points="9.5 14.5 12 12 14.5 14.5"/>',
  users:   '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  download:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload:  '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  template:'<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
};
const FOLDER_ICON = (size = 14, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function permKey(category, action) { return `${category}||${action}`; }
function splitKey(key) { const at = key.indexOf('||'); return { category: key.slice(0, at), action: key.slice(at + 2) }; }

function uid() { return Math.random().toString(36).slice(2, 10); }

function initials(name) {
  return (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

// Stable accent colour per role, so roles are easy to tell apart at a glance
function hueClass(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hue-${h % 6}`;
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape `text` and wrap every case-insensitive occurrence of `query` in <mark>
function highlight(text, query) {
  if (!query) return escHtml(text);
  const lower = text.toLowerCase();
  let out = '', from = 0, at;
  while ((at = lower.indexOf(query, from)) !== -1) {
    out += escHtml(text.slice(from, at)) + '<mark>' + escHtml(text.slice(at, at + query.length)) + '</mark>';
    from = at + query.length;
  }
  return out + escHtml(text.slice(from));
}

function isTypingTarget(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

// Accepts a plain date ('2026-11-12') or a full timestamp, and shows it in local time
function formatDate(iso) {
  const text = String(iso);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return isNaN(d) ? text : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Today's date as the user sees it on their own clock (not UTC), for file names
function todayStamp() {
  const d = new Date();
  const two = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

// Ids end up in HTML attributes and selectors, so anything read from storage or a file is
// only kept if it has the shape this app generates. Otherwise it gets a fresh one.
function safeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : uid();
}

// Names are single-line everywhere they are shown or exported
function oneLine(text) {
  return String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();
}

// ── Permission catalogue lookups ──────────────────────────────────────────────
// permKey -> { category, action, description, added? }
const PERM_INDEX = new Map();
PERMISSIONS_DATA.forEach(cat => cat.permissions.forEach(p =>
  PERM_INDEX.set(permKey(cat.category, p.action), { category: cat.category, ...p })));

function getPermDescription(category, action) {
  return PERM_INDEX.get(permKey(category, action))?.description || '';
}

function countCategoriesUsed(role) {
  return PERMISSIONS_DATA.filter(cat =>
    cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
  ).length;
}

// Permissions Microsoft added to Intune after this role was last reviewed
function newPermissionKeys(role) {
  const since = role.reviewed || CATALOG_BASELINE;
  const keys = [];
  PERM_INDEX.forEach((perm, key) => { if (perm.added && perm.added > since) keys.push(key); });
  return keys;
}

// ── Roles: creating, saving, loading ──────────────────────────────────────────
function makeRole(fields = {}) {
  return {
    id: uid(), name: 'New Role', groupId: null,
    permissions: new Set(), description: '', notes: {}, assignments: [],
    reviewed: CATALOG_DATE,
    unknown: [],
    ...fields,
  };
}

function makeAssignment(fields = {}) {
  return { id: uid(), name: '', description: '', adminGroups: [], scopeGroups: [], scopeTags: [], ...fields };
}

function cleanList(list) {
  return Array.isArray(list) ? [...new Set(list.map(oneLine).filter(Boolean))] : [];
}

function serializeRole(r) {
  return {
    id: r.id, name: r.name, groupId: r.groupId || null,
    // Permissions this version doesn't know are kept in the file, so a newer version gets them back
    permissions: [...r.permissions, ...(r.unknown || [])],
    description: r.description || '',
    notes: r.notes || {},
    assignments: (r.assignments || []).map(a => ({
      id: a.id, name: a.name || '', description: a.description || '',
      adminGroups: a.adminGroups || [], scopeGroups: a.scopeGroups || [], scopeTags: a.scopeTags || [],
    })),
    reviewed: r.reviewed || CATALOG_BASELINE,
  };
}

// Carry selections (and notes) across renamed permissions (see PERMISSION_RENAMES)
function migratePermissions(keys) {
  const perms = new Set(keys);
  PERMISSION_RENAMES.forEach(({ category, from, to }) => {
    if (perms.delete(permKey(category, from))) perms.add(permKey(category, to));
  });
  return perms;
}

function migrateNotes(notes) {
  const out = {};
  if (!notes || typeof notes !== 'object') return out;
  Object.entries(notes).forEach(([key, text]) => {
    if (typeof text === 'string' && text.trim()) out[key] = text;
  });
  PERMISSION_RENAMES.forEach(({ category, from, to }) => {
    const oldKey = permKey(category, from);
    if (oldKey in out) { out[permKey(category, to)] = out[oldKey]; delete out[oldKey]; }
  });
  return out;
}

// Turns saved data (any version, or an imported file) back into a role. Nothing in `raw` is
// trusted: wrong types fall back to defaults, and ids are regenerated unless well-formed.
// Saves from before `reviewed` existed predate every permission that carries an `added` date.
// `groupIds` maps the folder ids used in the data to the ids the revived folders ended up with.
function reviveRole(raw, groupIds = null) {
  if (!raw || typeof raw !== 'object') return null;
  const isObject = v => v && typeof v === 'object';
  const keys = migratePermissions((Array.isArray(raw.permissions) ? raw.permissions : []).filter(k => typeof k === 'string'));
  const known = new Set(), unknown = [];
  keys.forEach(k => (PERM_INDEX.has(k) ? known.add(k) : unknown.push(k)));
  return makeRole({
    id: safeId(raw.id),
    name: typeof raw.name === 'string' ? oneLine(raw.name) : '',
    groupId: groupIds ? (groupIds.get(raw.groupId) || null) : null,
    permissions: known,
    unknown,
    description: typeof raw.description === 'string' ? raw.description : '',
    notes: migrateNotes(raw.notes),
    assignments: (Array.isArray(raw.assignments) ? raw.assignments : []).filter(isObject).map(a => makeAssignment({
      id: safeId(a.id),
      name: typeof a.name === 'string' ? oneLine(a.name) : '',
      description: typeof a.description === 'string' ? oneLine(a.description) : '',
      adminGroups: cleanList(a.adminGroups), scopeGroups: cleanList(a.scopeGroups), scopeTags: cleanList(a.scopeTags),
    })),
    reviewed: typeof raw.reviewed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.reviewed) ? raw.reviewed : CATALOG_BASELINE,
  });
}

// Folders from saved data or a file: returns them with safe ids, plus a map from the ids the
// data used to the ids now in use, so roles can be put back in the right folder.
function reviveGroups(rawGroups) {
  const ids = new Map();
  const list = [];
  (Array.isArray(rawGroups) ? rawGroups : []).forEach(g => {
    if (!g || typeof g !== 'object' || ids.has(g.id)) return;
    const group = { id: safeId(g.id), name: oneLine(g.name) || 'Folder', collapsed: !!g.collapsed };
    ids.set(g.id, group.id);
    list.push(group);
  });
  return { groups: list, ids };
}

// Both of the above for a whole save or backup
function reviveAll(data) {
  const revived = reviveGroups(Array.isArray(data) ? [] : data.groups);
  const rawRoles = Array.isArray(data) ? data : (Array.isArray(data.roles) ? data.roles : []);
  const list = rawRoles.map(r => reviveRole(r, revived.ids)).filter(Boolean);
  return { groups: revived.groups, roles: list, skipped: rawRoles.length - list.length };
}

function saveState() {
  const data = {
    version: SAVE_VERSION,
    groups,
    roles: roles.map(serializeRole),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Set when saved data could not be read in full; shown to the user once the app is up
let loadProblem = '';

// Saved data the app could not read is set aside under its own key rather than lost: the next
// save would otherwise overwrite it. "Backup and import" offers it back as a file.
const UNREADABLE_KEY = `${STORAGE_KEY}.unreadable`;

function keepUnreadable(raw) {
  try { localStorage.setItem(UNREADABLE_KEY, raw); return true; } catch { return false; }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const where = kept => (kept ? ' The original data has been kept: open Backup and import to save it as a file.' : '');
  try {
    // Handles every format so far, including the first one: a plain array of roles
    const revived = reviveAll(JSON.parse(raw));
    groups = revived.groups;
    roles  = revived.roles;
    if (revived.skipped) {
      loadProblem = `${plural(revived.skipped, 'saved role', 'saved roles')} couldn't be read and ${revived.skipped === 1 ? 'was' : 'were'} left out.${where(keepUnreadable(raw))}`;
    }
  } catch {
    roles = []; groups = [];
    loadProblem = `Your saved roles couldn't be read, so the app has started empty.${where(keepUnreadable(raw))}`;
  }
  if (roles.length > 0) activeRoleId = roles[0].id;
}

function loadViewPrefs() {
  showDescriptions = localStorage.getItem(SHOW_DESC_KEY) !== '0';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
// `action` is optional: { label, onClick } adds a button (used for Undo).
function showToast(msg, type = '', action = null) {
  const toast = document.getElementById('toast');
  toast.textContent = '';

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = msg;
  toast.appendChild(text);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { hideToast(); action.onClick(); });
    toast.appendChild(btn);
  }

  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  // A sticky toast stays until its button is pressed
  if (!action?.sticky) toastTimer = setTimeout(hideToast, action ? 8000 : 3000);
}

function hideToast() {
  clearTimeout(toastTimer);
  document.getElementById('toast').classList.remove('show');
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

function showTooltip(text, e) { tooltip.textContent = text; positionTooltip(e); tooltip.classList.add('visible'); }
function hideTooltip()        { tooltip.classList.remove('visible'); }

function positionTooltip(e) {
  const pad = 12, tw = 320;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + tw > window.innerWidth)  x = Math.max(pad, e.clientX - tw - pad);
  tooltip.style.left = x + 'px';
  // Descriptions vary a lot in length, so measure the real height before placing vertically
  const th = tooltip.offsetHeight;
  if (y + th > window.innerHeight) y = Math.max(pad, e.clientY - th - pad);
  tooltip.style.top  = y + 'px';
}

document.addEventListener('mousemove', e => { if (tooltip.classList.contains('visible')) positionTooltip(e); });

// ── Dialog ────────────────────────────────────────────────────────────────────
// One reusable dialog. `body` and `footer` are HTML strings; anything carrying `data-close`
// closes it. Returns the elements so the caller can wire up its own controls.
let dialogOnClose = null;

function openDialog({ eyebrow = '', title, body = '', footer = '', size = 'md', onClose = null }) {
  closeMenu();
  const overlay = document.getElementById('dialog');
  const box     = document.getElementById('dialog-box');
  if (overlay.classList.contains('open') && dialogOnClose) dialogOnClose();

  document.getElementById('dialog-eyebrow').textContent = eyebrow;
  document.getElementById('dialog-eyebrow').hidden = !eyebrow;
  document.getElementById('dialog-title').textContent = title;
  const bodyEl   = document.getElementById('dialog-body');
  const footerEl = document.getElementById('dialog-footer');
  bodyEl.innerHTML   = body;
  footerEl.innerHTML = footer || '<button class="btn btn-primary" data-close>Done</button>';
  bodyEl.scrollTop = 0;

  box.className = `modal modal-${size}`;
  dialogOnClose = onClose;
  overlay.classList.add('open');
  setBackgroundInert(true);
  const first = footerEl.querySelector('[data-close]') || document.getElementById('dialog-close');
  if (first) first.focus();
  return { box, body: bodyEl, footer: footerEl };
}

function closeDialog() {
  const overlay = document.getElementById('dialog');
  if (!overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  setBackgroundInert(false);
  const done = dialogOnClose;
  dialogOnClose = null;
  if (done) done();
}

// While a dialog is up, the page behind it is out of reach of the keyboard too
function setBackgroundInert(on) {
  const anyOpen = on || !!document.querySelector('.modal-overlay.open');
  document.querySelectorAll('.app-body, .mobile-bar').forEach(el => { el.inert = anyOpen; });
}

function isDialogOpen() { return document.getElementById('dialog').classList.contains('open'); }

function initDialog() {
  const overlay = document.getElementById('dialog');
  document.getElementById('dialog-close').addEventListener('click', closeDialog);
  // A click on the backdrop closes the dialog, but only if the press started there too:
  // selecting text and letting go just outside the box must not throw the dialog away.
  let pressedOnBackdrop = false;
  overlay.addEventListener('mousedown', e => { pressedOnBackdrop = e.target === overlay; });
  overlay.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || (e.target === overlay && pressedOnBackdrop)) closeDialog();
  });
}

// ── Popover menu ──────────────────────────────────────────────────────────────
// items: [{ label, hint?, icon?, onSelect }]
let openMenuEl = null;

function closeMenu() {
  if (!openMenuEl) return;
  openMenuEl.remove();
  openMenuEl = null;
  document.removeEventListener('mousedown', onMenuOutside, true);
}

function onMenuOutside(e) {
  if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu();
}

function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.innerHTML = `${item.icon ? icon(item.icon, 15) : ''}<span class="menu-text"><span class="menu-label">${escHtml(item.label)}</span>${item.hint ? `<span class="menu-hint">${escHtml(item.hint)}</span>` : ''}</span>`;
    btn.addEventListener('click', () => { closeMenu(); item.onSelect(); });
    menu.appendChild(btn);
  });
  menu.addEventListener('keydown', e => {
    const buttons = [...menu.querySelectorAll('.menu-item')];
    const at = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(at + 1) % buttons.length].focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length].focus(); }
    if (e.key === 'Escape')    { e.preventDefault(); closeMenu(); anchor.focus(); }
  });
  document.body.appendChild(menu);

  const a = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(a.left, window.innerWidth - menu.offsetWidth - 8));
  const below = a.bottom + 6;
  const top = below + menu.offsetHeight > window.innerHeight ? Math.max(8, a.top - menu.offsetHeight - 6) : below;
  menu.style.left = left + 'px';
  menu.style.top  = top + 'px';

  openMenuEl = menu;
  menu.querySelector('.menu-item').focus();
  document.addEventListener('mousedown', onMenuOutside, true);
}

// ── Files and clipboard ───────────────────────────────────────────────────────
function downloadFile(filename, text, mime = 'application/json') {
  const url  = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Opens the system file picker; resolves with { name, text } or null if nothing was chosen
function pickFile(accept = '.json,application/json') {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      resolve({ name: file.name, text: await file.text() });
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

// ── Small-screen sidebar drawer ───────────────────────────────────────────────
function openSidebar()  { document.body.classList.add('sidebar-open'); }
function closeSidebar() { document.body.classList.remove('sidebar-open'); }

// ── Group Operations ──────────────────────────────────────────────────────────
function createGroup(name = 'New Folder') {
  const group = { id: uid(), name, collapsed: false };
  groups.push(group);
  saveState();
  renderSidebar();
  refreshGroupSelect();
  // Trigger inline rename immediately
  setTimeout(() => startRenameGroup(group.id), 30);
}

// Finds a folder by name, or makes one. Used by imports.
function ensureGroup(name) {
  const existing = groups.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const group = { id: uid(), name, collapsed: false };
  groups.push(group);
  return group;
}

function deleteGroup(id) {
  const index = groups.findIndex(g => g.id === id);
  if (index < 0) return;
  const group    = groups[index];
  const movedIds = roles.filter(r => r.groupId === id).map(r => r.id);

  roles.forEach(r => { if (r.groupId === id) r.groupId = null; });
  groups.splice(index, 1);
  saveState();
  renderSidebar();
  refreshGroupSelect();

  const moved = movedIds.length ? ` ${plural(movedIds.length, 'role', 'roles')} moved to No Folder.` : '';
  showToast(`Folder "${group.name}" deleted.${moved}`, '', {
    label: 'Undo',
    onClick: () => {
      groups.splice(Math.min(index, groups.length), 0, group);
      roles.forEach(r => { if (movedIds.includes(r.id)) r.groupId = id; });
      saveState();
      renderSidebar();
      refreshGroupSelect();
    }
  });
}

function renameGroup(id, name) {
  const group = groups.find(g => g.id === id);
  if (!group) return;
  group.name = name.trim() || group.name;
  saveState();
  renderSidebar();
  refreshGroupSelect();
}

function toggleGroupCollapse(id) {
  const group = groups.find(g => g.id === id);
  if (!group) return;
  group.collapsed = !group.collapsed;
  saveState();
  renderSidebar();
}

function moveRoleToGroup(roleId, groupId) {
  const role = roles.find(r => r.id === roleId);
  if (!role) return;
  role.groupId = groupId || null;
  saveState();
  renderSidebar();
  refreshGroupSelect();
}

// Keep the folder picker in the editor in step with folder changes made in the sidebar
function refreshGroupSelect() {
  const sel  = document.getElementById('role-group-select');
  const role = getActiveRole();
  if (!sel || !role) return;
  sel.innerHTML = groupOptionsHtml(role);
}

function groupOptionsHtml(role) {
  return `<option value=""${!role.groupId ? ' selected' : ''}>No folder</option>` +
    groups.map(g =>
      `<option value="${escAttr(g.id)}"${role.groupId === g.id ? ' selected' : ''}>${escHtml(g.name)}</option>`
    ).join('');
}

// ── Inline Group Rename ───────────────────────────────────────────────────────
function startRenameGroup(id) {
  const nameEl = document.querySelector(`.group-name[data-group-id="${id}"]`);
  if (!nameEl) return;
  const group = groups.find(g => g.id === id);
  if (!group) return;

  const original = group.name;
  const input = document.createElement('input');
  input.className = 'group-rename-input';
  input.value = original;
  input.maxLength = 60;
  input.setAttribute('aria-label', 'Folder name');

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  function commit() {
    if (done) return;
    done = true;
    renameGroup(id, input.value.trim() || original);
  }

  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.value = original; commit(); }
  });
  input.addEventListener('blur', commit);
}

// ── Role Operations ───────────────────────────────────────────────────────────
// Adds a role to the list (after the last role of its folder, if it has one) and opens it
function addRole(role) {
  if (role.groupId) {
    const lastIdx = roles.reduce((acc, r, i) => r.groupId === role.groupId ? i : acc, -1);
    if (lastIdx >= 0) roles.splice(lastIdx + 1, 0, role);
    else roles.push(role);
  } else {
    roles.push(role);
  }
  activeRoleId = role.id;
  // A new role has nothing to search for or filter yet — start from the full list
  searchQuery = '';
  filterMode  = 'all';
  editorTab   = 'permissions';
  saveState();
  render();
  closeSidebar();
  return role;
}

function createRole(name = 'New Role', groupId = null) {
  const role = addRole(makeRole({ name, groupId }));
  setTimeout(() => {
    const input = document.querySelector('.role-name-input');
    if (input) { input.focus(); input.select(); }
  }, 50);
  return role;
}

function duplicateRole(id) {
  const src = roles.find(r => r.id === id);
  if (!src) return;
  const copy = makeRole({
    name: `${src.name} (Copy)`,
    groupId: src.groupId,
    permissions: new Set(src.permissions),
    description: src.description,
    notes: { ...src.notes },
    assignments: src.assignments.map(a => makeAssignment({
      ...a, id: uid(), adminGroups: [...a.adminGroups], scopeGroups: [...a.scopeGroups], scopeTags: [...a.scopeTags],
    })),
    reviewed: src.reviewed,
    unknown: [...(src.unknown || [])],
  });
  const idx = roles.findIndex(r => r.id === id);
  roles.splice(idx + 1, 0, copy);
  activeRoleId = copy.id;
  saveState();
  render();
  showToast(`"${src.name}" duplicated.`, 'success');
}

function deleteRole(id) {
  const index = roles.findIndex(r => r.id === id);
  if (index < 0) return;
  const role = roles[index];

  roles.splice(index, 1);
  if (activeRoleId === id) {
    const next = roles[index] || roles[index - 1] || null;
    activeRoleId = next ? next.id : null;
  }
  saveState();
  render();

  showToast(`"${role.name || 'Unnamed role'}" deleted.`, '', {
    label: 'Undo',
    onClick: () => {
      if (role.groupId && !groups.some(g => g.id === role.groupId)) role.groupId = null;
      roles.splice(Math.min(index, roles.length), 0, role);
      activeRoleId = role.id;
      saveState();
      render();
    }
  });
}

function getActiveRole() { return roles.find(r => r.id === activeRoleId) || null; }

function selectRole(id) {
  activeRoleId = id;
  render();
  closeSidebar();
}

// Opens a role and takes the user to one exact permission (used by "Who has a permission?")
function showRolePermission(roleId, category, action) {
  activeRoleId = roleId;
  searchQuery  = '';
  filterMode   = 'all';
  editorTab    = 'permissions';
  render();
  closeSidebar();

  const row = [...document.querySelectorAll('#permissions-pane .perm-row')]
    .find(r => r.dataset.cat === category && r.dataset.action === action);
  if (!row) return;
  setCategoryCollapsed(row.closest('.category-block'), false);
  row.scrollIntoView({ block: 'center' });
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 2400);
}

function openNewRoleMenu(anchor) {
  openMenu(anchor, [
    { label: 'Blank role', hint: 'Start with nothing selected', icon: ICON.plus, onSelect: () => createRole() },
    { label: 'From a built-in role', hint: "Start from one of Microsoft's roles and trim it", icon: ICON.template, onSelect: () => openBuiltInDialog() },
    { label: 'Import from a file', hint: 'A backup, or roles exported from Intune', icon: ICON.upload, onSelect: () => openDataDialog() },
  ]);
}

// ── Destructive Permission Confirmation ───────────────────────────────────────
const DESTRUCTIVE_PERMISSIONS = new Set([
  permKey('Managed devices',  'Delete'),
  permKey('Managed apps',     'Wipe'),
  permKey('Remote tasks',     'Wipe'),
  permKey('Remote tasks',     'Retire'),
  permKey('Remote tasks',     'Reset passcode'),
  permKey('Remote tasks',     'Disable lost mode'),
  // Not destructive, but they let a helper into a device with nobody at it. Microsoft's
  // guidance is to grant these explicitly, in a dedicated role scoped to specific devices.
  permKey('Remote Help app',  'Android unattended control'),
  permKey('Remote Help app',  'Windows unattended control remote sign-in'),
]);

let suppressDestructiveWarnings = false;

function isDestructive(category, action) {
  return DESTRUCTIVE_PERMISSIONS.has(permKey(category, action));
}

function highImpactKeys(role) {
  return [...role.permissions].filter(k => DESTRUCTIVE_PERMISSIONS.has(k));
}

function confirmDestructive(items) {
  return new Promise(resolve => {
    if (suppressDestructiveWarnings || items.length === 0) { resolve(true); return; }

    const modal     = document.getElementById('destructive-modal');
    const list      = document.getElementById('destructive-list');
    const dontShow  = document.getElementById('destructive-dont-show');
    const btnOk     = document.getElementById('destructive-confirm');
    const btnCancel = document.getElementById('destructive-cancel');

    document.getElementById('destructive-title').textContent =
      items.length === 1 ? 'High-impact permission' : `${items.length} high-impact permissions`;

    list.innerHTML = items.map(({ category, action }) => `
      <li>
        <span class="destructive-perm-name">${escHtml(category)} — ${escHtml(action)}</span>
        <span class="destructive-perm-desc">${escHtml(getPermDescription(category, action))}</span>
      </li>`).join('');
    dontShow.checked = false;

    function cleanup() {
      modal.classList.remove('open');
      setBackgroundInert(false);
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey, true);
    }
    function onOk()     { if (dontShow.checked) suppressDestructiveWarnings = true; cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    function onBackdrop(e) { if (e.target === modal) onCancel(); }
    // Capture phase, so Escape answers this prompt and nothing underneath it
    function onKey(e)      { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey, true);
    modal.classList.add('open');
    setBackgroundInert(true);
    btnCancel.focus();
  });
}

// ── Permission Toggle ─────────────────────────────────────────────────────────
function togglePermission(category, action) {
  const role = getActiveRole();
  if (!role) return;
  const key = permKey(category, action);
  role.permissions.has(key) ? role.permissions.delete(key) : role.permissions.add(key);
  saveState();
  updateRoleIndicators(role);
}

async function toggleCategory(category) {
  const role = getActiveRole();
  if (!role) return;
  const cat = PERMISSIONS_DATA.find(c => c.category === category);
  if (!cat) return;
  const allSelected = cat.permissions.every(p => role.permissions.has(permKey(category, p.action)));

  if (!allSelected) {
    const pending = cat.permissions
      .filter(p => isDestructive(category, p.action) && !role.permissions.has(permKey(category, p.action)))
      .map(p => ({ category, action: p.action }));
    if (pending.length > 0 && !(await confirmDestructive(pending))) return;
  }

  cat.permissions.forEach(p => {
    const key = permKey(category, p.action);
    allSelected ? role.permissions.delete(key) : role.permissions.add(key);
  });
  saveState();
  updateRoleIndicators(role);
  renderCategoryCheckboxes(category);
  updateCategoryHeader(category);
}

// ── Render Helpers ────────────────────────────────────────────────────────────
// Everything that summarises the open role: the count line, the "to check" and "new" pills,
// the tab badge, and the role's row in the sidebar.
function updateRoleIndicators(role) {
  const stats = document.getElementById('perm-stats');
  if (stats) {
    const count = role.permissions.size;
    const cats  = countCategoriesUsed(role);
    stats.innerHTML = `<strong>${count}</strong> of ${TOTAL_PERMISSIONS} permissions selected` +
      (count ? ` <span class="meta-sep">·</span> ${plural(cats, 'category', 'categories')}` : '');
  }
  const seg = document.getElementById('seg-selected-count');
  if (seg) seg.textContent = role.permissions.size;

  const findings = runChecks(role, roles);
  const checksPill = document.getElementById('checks-pill');
  if (checksPill) {
    checksPill.hidden = findings.length === 0;
    checksPill.classList.toggle('pill-warn', findings.some(f => f.level === 'warn'));
    checksPill.innerHTML = `${icon(ICON.alert, 12, 'stroke-width="2.4"')}${findings.length} to check`;
  }

  const fresh = newPermissionKeys(role);
  const newPill = document.getElementById('new-pill');
  if (newPill) {
    newPill.hidden = fresh.length === 0;
    newPill.innerHTML = `${icon(ICON.sparkle, 12, 'stroke-width="2.2"')}${fresh.length} new`;
  }
  const segNew = document.querySelector('.segmented button[data-filter="new"]');
  if (segNew) {
    segNew.hidden = fresh.length === 0;
    segNew.querySelector('.seg-count').textContent = fresh.length;
  }
  const banner = document.getElementById('new-banner');
  if (banner) banner.hidden = fresh.length === 0;

  const tabCount = document.getElementById('tab-assignments-count');
  if (tabCount) {
    tabCount.textContent = role.assignments.length;
    tabCount.hidden = role.assignments.length === 0;
  }

  updateSidebarRole(role, findings);
}

function updateSidebarRole(role, findings = runChecks(role, roles)) {
  const item = document.querySelector(`.role-item[data-id="${role.id}"]`);
  if (!item) return;
  item.querySelector('.role-count').textContent = role.permissions.size;
  const flag = item.querySelector('.role-flag');
  const warns = findings.filter(f => f.level === 'warn').length;
  flag.hidden = warns === 0;
  flag.title = warns ? `${plural(warns, 'thing', 'things')} to check` : '';
}

function updateCategoryHeader(category) {
  const block = document.querySelector(`.category-block[data-cat="${CSS.escape(category)}"]`);
  if (!block) return;
  const role = getActiveRole();
  const cat  = PERMISSIONS_DATA.find(c => c.category === category);
  if (!role || !cat) return;
  const selCount  = cat.permissions.filter(p => role.permissions.has(permKey(category, p.action))).length;
  const total     = cat.permissions.length;
  const hasSelected = selCount > 0;
  block.classList.toggle('has-selected', hasSelected);
  block.querySelector('.category-header').classList.toggle('has-selected', hasSelected);
  const badge = block.querySelector('.category-badge');
  badge.textContent = hasSelected ? `${selCount}/${total}` : total;
  badge.classList.toggle('has-selected', hasSelected);
  const toggleBtn = block.querySelector('.category-toggle-all');
  if (toggleBtn) toggleBtn.textContent = selCount === total ? 'Clear all' : 'Select all';
}

function renderCategoryCheckboxes(category) {
  const role  = getActiveRole();
  const block = document.querySelector(`.category-block[data-cat="${CSS.escape(category)}"]`);
  if (!block || !role) return;
  block.querySelectorAll('.perm-row').forEach(row => {
    const cb  = row.querySelector('input[type="checkbox"]');
    const key = permKey(category, row.dataset.action);
    const checked = role.permissions.has(key);
    cb.checked = checked;
    row.classList.toggle('selected', checked);
  });
}

function setCategoryCollapsed(block, collapsed) {
  block.classList.toggle('collapsed', collapsed);
  block.querySelector('.category-header').setAttribute('aria-expanded', String(!collapsed));
}

// Long descriptions are clamped to three lines. Offer "Show more" only where text is
// really cut off at the current width — this re-checks whenever a description resizes,
// which covers expanding a category, resizing the window or sidebar, and toggling views.
function isClamped(desc) { return desc.scrollHeight > desc.clientHeight + 1; }

const clampObserver = new ResizeObserver(entries => {
  entries.forEach(({ target }) => {
    const row = target.closest('.perm-row');
    const btn = row && row.querySelector('.perm-more');
    if (!btn || row.classList.contains('expanded')) return;
    btn.hidden = !isClamped(target);
  });
});

// ── Permission notes ──────────────────────────────────────────────────────────
// An optional line per granted permission saying why the role needs it.
function noteHtml(role, key) {
  const text = role.notes[key];
  return text
    ? `<button type="button" class="perm-note-text" title="Edit note">${icon(ICON.note, 12)}<span>${escHtml(text)}</span></button>`
    : `<button type="button" class="perm-note-add">${icon(ICON.note, 12)}Add a note</button>`;
}

function editNote(row) {
  const role = getActiveRole();
  if (!role) return;
  const key  = permKey(row.dataset.cat, row.dataset.action);
  const wrap = row.querySelector('.perm-note');
  const input = document.createElement('input');
  input.className = 'perm-note-input';
  input.maxLength = 300;
  input.placeholder = 'Why does this role need it? (optional)';
  input.value = role.notes[key] || '';
  input.setAttribute('aria-label', `Note for ${row.dataset.action}`);
  wrap.innerHTML = '';
  wrap.classList.remove('is-empty');
  wrap.appendChild(input);
  input.focus();

  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      const text = input.value.trim();
      if (text) role.notes[key] = text; else delete role.notes[key];
      saveState();
    }
    wrap.innerHTML = noteHtml(role, key);
    wrap.classList.toggle('is-empty', !role.notes[key]);
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// ── Filtering ─────────────────────────────────────────────────────────────────
function applyFilter() {
  const pane = document.getElementById('permissions-pane');
  const role = getActiveRole();
  if (!pane || !role) return;

  const q         = searchQuery.toLowerCase().trim();
  const freshKeys = new Set(newPermissionKeys(role));
  if (filterMode === 'new' && freshKeys.size === 0) filterMode = 'all';
  let shown = 0;

  pane.querySelectorAll('.category-block').forEach(block => {
    const cat        = block.dataset.cat;
    const catMatches = !!q && cat.toLowerCase().includes(q);
    let visible = 0;

    block.querySelectorAll('.perm-row').forEach(row => {
      const action = row.dataset.action, desc = row.dataset.desc;
      const key    = permKey(cat, action);
      const textOk = !q || catMatches
        || action.toLowerCase().includes(q)
        || desc.toLowerCase().includes(q)
        || (role.notes[key] || '').toLowerCase().includes(q);
      const modeOk = filterMode === 'selected' ? role.permissions.has(key)
                   : filterMode === 'new'      ? freshKeys.has(key)
                   : true;
      const ok = textOk && modeOk;
      row.classList.toggle('hidden-filter', !ok);
      if (ok) visible++;
      row.querySelector('.perm-action').innerHTML = highlight(action, q);
      row.querySelector('.perm-desc').innerHTML   = highlight(desc, q);
    });

    block.querySelector('.category-name').innerHTML = highlight(cat, q);
    block.classList.toggle('hidden', visible === 0);
    shown += visible;
  });

  // While filtering, every match is shown expanded and the bulk controls step aside
  const filtering = !!q || filterMode !== 'all';
  pane.classList.toggle('is-filtering', filtering);
  pane.classList.toggle('is-searching', !!q);
  document.getElementById('btn-expand-all').disabled   = filtering;
  document.getElementById('btn-collapse-all').disabled = filtering;
  document.querySelector('.search-wrap').classList.toggle('has-query', !!searchQuery);
  document.querySelectorAll('.segmented button').forEach(btn => {
    const on = btn.dataset.filter === filterMode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });

  const countEl = document.getElementById('result-count');
  countEl.hidden = !q;
  countEl.textContent = plural(shown, 'match', 'matches');

  const empty = document.getElementById('no-results');
  empty.hidden = shown > 0;
  if (shown === 0) {
    const nothingSelected = filterMode === 'selected' && !q && role.permissions.size === 0;
    empty.querySelector('h3').textContent = nothingSelected
      ? 'Nothing selected yet'
      : 'No permissions found';
    empty.querySelector('p').textContent = nothingSelected
      ? 'This role has no permissions. Switch back to All to start adding some.'
      : filterMode === 'selected'
        ? `None of this role's selected permissions match "${searchQuery.trim()}".`
        : filterMode === 'new'
          ? `None of the new permissions match "${searchQuery.trim()}".`
          : `Nothing matches "${searchQuery.trim()}". Try a category, a permission name, or a word from its description.`;
    empty.querySelector('button').textContent = nothingSelected ? 'Show all permissions' : 'Clear filters';
  }
}

function clearFilters() {
  searchQuery = '';
  filterMode  = 'all';
  const input = document.getElementById('perm-search');
  if (input) input.value = '';
  applyFilter();
}

function markReviewed(role) {
  const previous = role.reviewed;
  role.reviewed = CATALOG_DATE;
  if (filterMode === 'new') filterMode = 'all';
  saveState();
  renderMainPanel();
  showToast('Marked as reviewed.', 'success', {
    label: 'Undo',
    onClick: () => { role.reviewed = previous; saveState(); renderMainPanel(); }
  });
}

// ── Mouse-based Drag & Drop ────────────────────────────────────────────────────
const DRAG_THRESHOLD = 5; // px of movement before drag starts

function clearDropHighlights() {
  document.querySelectorAll('.drop-over').forEach(el => el.classList.remove('drop-over'));
}

function startMouseDrag(roleId, startX, startY, sourceEl) {
  let dragStarted = false;
  let ghost = null;

  function getDropZoneAt(x, y) {
    // Temporarily hide ghost so elementFromPoint can see what's underneath
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = '';
    return el ? el.closest('[data-drop-group]') : null;
  }

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragStarted) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragStarted = true;

      // Build ghost
      const role = roles.find(r => r.id === roleId);
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML =
        `<div class="role-icon ${hueClass(roleId)}">${escHtml(initials(role ? role.name : '?'))}</div>` +
        `<span>${escHtml(role ? role.name : '')}</span>`;
      document.body.appendChild(ghost);
      sourceEl.classList.add('dragging');
      dragState = { roleId, ghost, sourceEl };
    }

    // Move ghost near cursor
    ghost.style.left = (e.clientX + 14) + 'px';
    ghost.style.top  = (e.clientY - 14) + 'px';

    // Highlight the drop zone under cursor
    const dropZone = getDropZoneAt(e.clientX, e.clientY);
    clearDropHighlights();
    if (dropZone) {
      const role = roles.find(r => r.id === roleId);
      const targetGroup  = dropZone.dataset.dropGroup || null;
      const currentGroup = role ? (role.groupId || null) : null;
      if (targetGroup !== currentGroup) {
        dropZone.classList.add('drop-over');
      }
    }
  }

  function onUp(e) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);

    if (!dragStarted) return; // Was just a click — nothing to do

    const dropZone = getDropZoneAt(e.clientX, e.clientY);
    clearDropHighlights();
    if (ghost) { ghost.remove(); ghost = null; }
    sourceEl.classList.remove('dragging');
    dragState = null;

    // Suppress the click event that the browser fires after mouseup
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 0);

    if (dropZone) {
      const targetGroup = dropZone.dataset.dropGroup || null;
      moveRoleToGroup(roleId, targetGroup);
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderRoleItem(role) {
  const active = role.id === activeRoleId;
  const warns  = runChecks(role, roles).filter(f => f.level === 'warn').length;
  const item = document.createElement('div');
  item.className = `role-item${active ? ' active' : ''}`;
  item.dataset.id = role.id;
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  if (active) item.setAttribute('aria-current', 'true');
  item.innerHTML = `
    <div class="drag-handle" title="Drag to move">
      <svg width="8" height="14" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="3" cy="3"  r="1.5"/><circle cx="7" cy="3"  r="1.5"/>
        <circle cx="3" cy="8"  r="1.5"/><circle cx="7" cy="8"  r="1.5"/>
        <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
      </svg>
    </div>
    <div class="role-icon ${hueClass(role.id)}">${escHtml(initials(role.name))}</div>
    <div class="role-name" title="${escHtml(role.name)}">${escHtml(role.name || 'Unnamed role')}</div>
    <span class="role-flag" title="${warns ? `${plural(warns, 'thing', 'things')} to check` : ''}"${warns ? '' : ' hidden'}></span>
    <div class="role-count" title="Permissions selected">${role.permissions.size}</div>
  `;

  // Click (or Enter / Space) to select
  item.addEventListener('click', e => {
    if (suppressNextClick) return; // eat post-drag browser click
    if (e.target.closest('.drag-handle')) return;
    selectRole(role.id);
  });
  item.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    selectRole(role.id);
    // the sidebar was rebuilt — put keyboard focus back where it was
    document.querySelector(`.role-item[data-id="${role.id}"]`)?.focus();
  });

  // Initiate mouse drag (left-button only)
  item.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    startMouseDrag(role.id, e.clientX, e.clientY, item);
  });

  return item;
}

function renderSidebar() {
  const list = document.getElementById('roles-list');
  list.innerHTML = '';
  document.getElementById('sidebar-role-total').textContent = roles.length || '';

  const hasAnyContent = roles.length > 0 || groups.length > 0;
  if (!hasAnyContent) {
    list.innerHTML = '<p class="sidebar-empty">No roles yet.<br>Create one to get started.</p>';
    return;
  }

  // ── Grouped folders ──
  groups.forEach(group => {
    const groupRoles = roles.filter(r => r.groupId === group.id);

    const block = document.createElement('div');
    block.className = `group-block${group.collapsed ? ' collapsed' : ''}`;
    block.dataset.groupId = group.id;

    const header = document.createElement('div');
    header.className = 'group-header';
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', String(!group.collapsed));
    header.innerHTML = `
      ${icon(ICON.chevron, 13, 'class="group-chevron" stroke-width="2.5"')}
      ${FOLDER_ICON(14, 'group-folder-icon')}
      <span class="group-name" data-group-id="${group.id}" title="Double-click to rename">${escHtml(group.name)}</span>
      <span class="group-count">${groupRoles.length}</span>
      <div class="group-actions">
        <button class="group-add-btn" title="Add role to this folder" aria-label="Add role to ${escAttr(group.name)}">${icon(ICON.plus, 13, 'stroke-width="2.4"')}</button>
        <button class="group-rename-btn" title="Rename folder" aria-label="Rename ${escAttr(group.name)}">${icon(ICON.pencil, 12)}</button>
        <button class="group-delete-btn" title="Delete folder" aria-label="Delete ${escAttr(group.name)}">${icon(ICON.trash, 12)}</button>
      </div>
    `;

    // Collapse toggle (click anywhere on header except action buttons)
    header.addEventListener('click', e => {
      if (suppressNextClick) return;
      if (e.target.closest('.group-actions')) return;
      toggleGroupCollapse(group.id);
    });

    header.addEventListener('keydown', e => {
      if (e.target !== header) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleGroupCollapse(group.id);
      document.querySelector(`.group-block[data-group-id="${group.id}"] .group-header`)?.focus();
    });

    // Double-click group name to rename
    header.querySelector('.group-name').addEventListener('dblclick', e => {
      e.stopPropagation();
      startRenameGroup(group.id);
    });

    header.querySelector('.group-add-btn').addEventListener('click', e => {
      e.stopPropagation();
      createRole('New Role', group.id);
    });

    header.querySelector('.group-rename-btn').addEventListener('click', e => {
      e.stopPropagation();
      startRenameGroup(group.id);
    });

    header.querySelector('.group-delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      deleteGroup(group.id);
    });

    const body = document.createElement('div');
    body.className = 'group-body';
    body.dataset.dropGroup = group.id;   // drop-zone: into this folder

    if (groupRoles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'group-empty';
      empty.textContent = 'Drop a role here';
      body.appendChild(empty);
    } else {
      groupRoles.forEach(role => body.appendChild(renderRoleItem(role)));
    }

    // Header is also a drop zone so collapsed folders can receive drops
    header.dataset.dropGroup = group.id;

    block.appendChild(header);
    block.appendChild(body);
    list.appendChild(block);
  });

  // ── No Folder section — always shown when groups exist ──
  const ungrouped = roles.filter(r => !r.groupId);
  if (groups.length > 0 || ungrouped.length > 0) {
    if (groups.length > 0) {
      const label = document.createElement('div');
      label.className = 'ungrouped-label';
      label.textContent = 'No Folder';
      list.appendChild(label);
    }

    const noFolderZone = document.createElement('div');
    noFolderZone.className = 'no-folder-zone';
    noFolderZone.dataset.dropGroup = ''; // empty string = no folder (null group)

    if (ungrouped.length === 0 && groups.length > 0) {
      const hint = document.createElement('div');
      hint.className = 'group-empty';
      hint.textContent = 'Drop a role here to remove from folder';
      noFolderZone.appendChild(hint);
    } else {
      ungrouped.forEach(role => noFolderZone.appendChild(renderRoleItem(role)));
    }

    list.appendChild(noFolderZone);
  }
}

// ── Main Panel ────────────────────────────────────────────────────────────────
function renderEmptyState(panel) {
  panel.innerHTML = `
    <div class="empty-state">
      <div class="empty-illustration">${icon(ICON.layers, 30, 'stroke-width="1.7"')}</div>
      <h2>${roles.length ? 'Select a role' : 'Design your first role'}</h2>
      <p>${roles.length
        ? 'Pick a role from the list to edit its permissions, or start a new one.'
        : 'Work out exactly which Intune permissions a custom role needs before you build it in the admin center.'}</p>
      <div class="empty-actions">
        <button class="btn btn-primary btn-lg" id="btn-empty-new-role">${icon(ICON.plus, 16, 'stroke-width="2.4"')} New Role</button>
        <button class="btn btn-secondary btn-lg" id="btn-empty-built-in">${icon(ICON.template, 16)} Start from a built-in role</button>
      </div>
      <ol class="empty-steps">
        <li><span class="step-num">1</span>Name the role</li>
        <li><span class="step-num">2</span>Tick the permissions it needs</li>
        <li><span class="step-num">3</span>Export to Excel or an image</li>
      </ol>
    </div>`;
  document.getElementById('btn-empty-new-role').addEventListener('click', () => createRole());
  document.getElementById('btn-empty-built-in').addEventListener('click', () => openBuiltInDialog());
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function renderMainPanel() {
  const panel = document.getElementById('main-panel');
  const role  = getActiveRole();

  if (!role) { renderEmptyState(panel); return; }

  panel.innerHTML = `
    <div class="role-editor">
      <div class="role-editor-header">
        <div class="inner">
          <div class="role-header-left">
            <input class="role-name-input" type="text" value="${escHtml(role.name)}"
              placeholder="Name this role" id="role-name-input" maxlength="100" aria-label="Role name" autocomplete="off" spellcheck="false"/>
            <textarea class="role-desc-input" id="role-desc-input" rows="1" maxlength="500"
              placeholder="Add a description: what is this role for?" aria-label="Role description">${escHtml(role.description)}</textarea>
            <div class="role-meta">
              <label class="folder-chip" title="Move to folder">
                ${FOLDER_ICON(13)}
                <select id="role-group-select" class="role-group-select" aria-label="Folder">${groupOptionsHtml(role)}</select>
              </label>
              <span class="meta-sep">·</span>
              <div class="perm-stats" id="perm-stats"></div>
              <button class="pill" id="checks-pill" title="See what to double-check in this role" hidden></button>
              <button class="pill pill-new" id="new-pill" title="Permissions Microsoft added after this role was last reviewed" hidden></button>
            </div>
          </div>
          <div class="role-editor-actions">
            <button class="btn btn-secondary" id="btn-summary">${icon(ICON.summary, 15)} Summary</button>
            <button class="btn btn-secondary" id="btn-clone">${icon(ICON.copy, 15)} Clone</button>
            <button class="btn btn-secondary" id="btn-intune" title="Get a script or JSON that creates this role in Intune">${icon(ICON.cloud, 15)} Create in Intune</button>
            <button class="btn btn-danger" id="btn-delete">${icon(ICON.trash, 15)} Delete</button>
          </div>
        </div>
        <div class="role-tabs" role="tablist">
          <button class="tab" role="tab" data-tab="permissions">Permissions</button>
          <button class="tab" role="tab" data-tab="assignments">Assignments <span class="tab-count" id="tab-assignments-count" hidden></span></button>
        </div>
      </div>
      <div class="tab-body" id="tab-body"></div>
    </div>`;

  // ── Header ──
  const nameInput = document.getElementById('role-name-input');
  nameInput.addEventListener('input', e => {
    role.name = e.target.value;
    saveState();
    const nameEl = document.querySelector(`.role-item[data-id="${role.id}"] .role-name`);
    const iconEl = document.querySelector(`.role-item[data-id="${role.id}"] .role-icon`);
    if (nameEl) { nameEl.textContent = role.name || 'Unnamed role'; nameEl.title = role.name; }
    if (iconEl) iconEl.textContent = initials(role.name);
    updateRoleIndicators(role);
    // Whether a name is a duplicate depends on the other roles, so their markers can change too
    roles.forEach(other => { if (other !== role) updateSidebarRole(other); });
  });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') nameInput.blur();
  });

  const descInput = document.getElementById('role-desc-input');
  autoGrow(descInput);
  descInput.addEventListener('input', () => {
    role.description = descInput.value;
    saveState();
    autoGrow(descInput);
  });
  descInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); descInput.blur(); }
  });

  document.getElementById('role-group-select').addEventListener('change', e => {
    moveRoleToGroup(role.id, e.target.value);
  });

  document.getElementById('btn-summary').addEventListener('click', () => openSummaryDialog(role));
  document.getElementById('btn-clone').addEventListener('click',   () => duplicateRole(role.id));
  document.getElementById('btn-intune').addEventListener('click',  () => openIntuneExportDialog(role));
  document.getElementById('btn-delete').addEventListener('click',  () => deleteRole(role.id));
  document.getElementById('checks-pill').addEventListener('click', () => openChecksDialog(role));
  document.getElementById('new-pill').addEventListener('click', () => {
    editorTab  = 'permissions';
    filterMode = 'new';
    renderEditorTab(role);
  });

  panel.querySelectorAll('.role-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => { editorTab = tab.dataset.tab; renderEditorTab(role); });
  });

  hideTooltip();
  renderEditorTab(role);
}

function renderEditorTab(role) {
  document.querySelectorAll('.role-tabs .tab').forEach(tab => {
    const on = tab.dataset.tab === editorTab;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', String(on));
  });
  const body = document.getElementById('tab-body');
  clampObserver.disconnect();
  if (editorTab === 'assignments') renderAssignmentsTab(body, role);
  else renderPermissionsTab(body, role);
  updateRoleIndicators(role);
}

function renderPermissionsTab(body, role) {
  body.innerHTML = `
    <div class="perm-toolbar">
      <div class="inner">
        <div class="search-wrap">
          ${icon(ICON.search, 15, 'class="search-icon"')}
          <input class="search-input" type="text" placeholder="Search permissions" aria-label="Search permissions"
            id="perm-search" value="${escHtml(searchQuery)}" autocomplete="off" spellcheck="false"/>
          <kbd class="search-kbd" title="Press / to search">/</kbd>
          <button class="search-clear" id="perm-search-clear" title="Clear search" aria-label="Clear search">${icon(ICON.x, 12, 'stroke-width="2.6"')}</button>
        </div>
        <div class="segmented" role="group" aria-label="Show">
          <button data-filter="all">All</button>
          <button data-filter="selected">Selected <span class="seg-count" id="seg-selected-count">0</span></button>
          <button data-filter="new" hidden>New <span class="seg-count">0</span></button>
        </div>
        <span class="result-count" id="result-count" role="status" hidden></span>
        <div class="toolbar-spacer"></div>
        <label class="switch" title="Show each permission's description in the list">
          <input type="checkbox" id="toggle-descriptions" ${showDescriptions ? 'checked' : ''}/>
          <span class="switch-track"></span>
          <span>Descriptions</span>
        </label>
        <div class="toolbar-group">
          <button class="btn btn-ghost btn-sm" id="btn-expand-all" title="Expand all categories">${icon(ICON.expand, 15)}<span class="btn-label">Expand All</span></button>
          <button class="btn btn-ghost btn-sm" id="btn-collapse-all" title="Collapse all categories">${icon(ICON.collapse, 15)}<span class="btn-label">Collapse All</span></button>
        </div>
      </div>
    </div>

    <div class="permissions-pane${showDescriptions ? '' : ' hide-descriptions'}" id="permissions-pane">
      <div class="inner">
        <div class="banner banner-new" id="new-banner" hidden>
          ${icon(ICON.sparkle, 16, 'stroke-width="2.2"')}
          <div class="banner-text">
            <strong>Microsoft has added permissions since this role was last reviewed</strong>
            <span>Last reviewed against the permission list of ${escHtml(formatDate(role.reviewed))}. Decide whether this role needs the new ones.</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-show-new">Show them</button>
          <button class="btn btn-secondary btn-sm" id="btn-mark-reviewed">Mark as reviewed</button>
        </div>
        ${renderPermissionCategories(role)}
        <div class="no-results" id="no-results" hidden>
          ${icon(ICON.search, 30, 'stroke-width="1.6"')}
          <h3></h3>
          <p></p>
          <button class="btn btn-secondary btn-sm" id="btn-clear-filters"></button>
        </div>
      </div>
    </div>`;

  // ── Toolbar ──
  const searchInput = document.getElementById('perm-search');
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    applyFilter();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (searchQuery) { searchQuery = ''; searchInput.value = ''; applyFilter(); }
    else searchInput.blur();
  });
  document.getElementById('perm-search-clear').addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    applyFilter();
    searchInput.focus();
  });

  body.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => { filterMode = btn.dataset.filter; applyFilter(); });
  });
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
  document.getElementById('btn-show-new').addEventListener('click', () => { filterMode = 'new'; applyFilter(); });
  document.getElementById('btn-mark-reviewed').addEventListener('click', () => markReviewed(role));

  document.getElementById('toggle-descriptions').addEventListener('change', e => {
    showDescriptions = e.target.checked;
    localStorage.setItem(SHOW_DESC_KEY, showDescriptions ? '1' : '0');
    document.getElementById('permissions-pane').classList.toggle('hide-descriptions', !showDescriptions);
  });

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    body.querySelectorAll('.category-block').forEach(b => setCategoryCollapsed(b, false));
  });
  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    body.querySelectorAll('.category-block').forEach(b => setCategoryCollapsed(b, true));
  });

  // ── Categories ──
  body.querySelectorAll('.category-toggle-all').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleCategory(btn.dataset.cat); });
  });

  body.querySelectorAll('.category-header').forEach(header => {
    const block = header.closest('.category-block');
    const toggle = () => {
      // Filtered results are always shown expanded
      if (document.getElementById('permissions-pane').classList.contains('is-filtering')) return;
      setCategoryCollapsed(block, !block.classList.contains('collapsed'));
    };
    header.addEventListener('click', e => {
      if (e.target.closest('.category-toggle-all')) return;
      toggle();
    });
    header.addEventListener('keydown', e => {
      if (e.target !== header) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // ── Permission rows ──
  body.querySelectorAll('.perm-row input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const row    = cb.closest('.perm-row');
      const cat    = row.dataset.cat;
      const action = row.dataset.action;

      if (cb.checked && isDestructive(cat, action)) {
        const ok = await confirmDestructive([{ category: cat, action }]);
        if (!ok) { cb.checked = false; return; }
      }

      togglePermission(cat, action);
      row.classList.toggle('selected', cb.checked);
      updateCategoryHeader(cat);
    });
  });

  body.querySelectorAll('.perm-desc.is-long').forEach(desc => clampObserver.observe(desc));

  body.querySelectorAll('.perm-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.perm-row');
      const expanded = row.classList.toggle('expanded');
      btn.textContent = expanded ? 'Show less' : 'Show more';
      btn.setAttribute('aria-expanded', String(expanded));
      if (!expanded) btn.hidden = !isClamped(row.querySelector('.perm-desc'));
    });
  });

  document.getElementById('permissions-pane').addEventListener('click', e => {
    const noteBtn = e.target.closest('.perm-note-add, .perm-note-text');
    if (noteBtn) editNote(noteBtn.closest('.perm-row'));
  });

  // With descriptions hidden, the full text is still one hover away
  body.querySelectorAll('.perm-label').forEach(label => {
    const desc = label.closest('.perm-row').dataset.desc;
    label.addEventListener('mouseenter', e => { if (!showDescriptions) showTooltip(desc, e); });
    label.addEventListener('mouseleave', hideTooltip);
  });

  applyFilter();
}

function renderPermissionCategories(role) {
  const fresh = new Set(newPermissionKeys(role));
  return PERMISSIONS_DATA.map(cat => {
    const selCount = cat.permissions.filter(p => role.permissions.has(permKey(cat.category, p.action))).length;
    const hasSelected = selCount > 0;
    const total = cat.permissions.length;
    return `
      <section class="category-block${hasSelected ? ' has-selected' : ' collapsed'}" data-cat="${escAttr(cat.category)}">
        <div class="category-header${hasSelected ? ' has-selected' : ''}" role="button" tabindex="0" aria-expanded="${hasSelected}">
          ${icon(ICON.chevron, 15, 'class="category-chevron" stroke-width="2.4"')}
          <span class="category-name">${escHtml(cat.category)}</span>
          <button class="category-toggle-all" data-cat="${escAttr(cat.category)}">${selCount === total ? 'Clear all' : 'Select all'}</button>
          <span class="category-badge${hasSelected ? ' has-selected' : ''}" title="Selected / available">${hasSelected ? `${selCount}/${total}` : total}</span>
        </div>
        <div class="category-body">
          ${cat.permissions.map(perm => {
            const key     = permKey(cat.category, perm.action);
            const checked = role.permissions.has(key);
            const isLong  = perm.description.length > CLAMP_FROM;
            const flags   =
              (fresh.has(key)
                ? `<span class="perm-flag perm-flag-new" title="Added to Intune on ${escAttr(formatDate(perm.added))}">${icon(ICON.sparkle, 11, 'stroke-width="2.4"')}New</span>`
                : '') +
              (isDestructive(cat.category, perm.action)
                ? `<span class="perm-flag" title="You'll be asked to confirm before this is added">${icon(ICON.alert, 11, 'stroke-width="2.4"')}High impact</span>`
                : '');
            return `
              <div class="perm-row${checked ? ' selected' : ''}" data-cat="${escAttr(cat.category)}" data-action="${escAttr(perm.action)}" data-desc="${escAttr(perm.description)}">
                <label class="perm-label">
                  <input type="checkbox" ${checked ? 'checked' : ''}/>
                  <span class="perm-main">
                    <span class="perm-title"><span class="perm-action">${escHtml(perm.action)}</span>${flags}</span>
                    <span class="perm-desc${isLong ? ' is-long' : ''}">${escHtml(perm.description)}</span>
                  </span>
                </label>
                ${isLong ? '<button type="button" class="perm-more" aria-expanded="false" hidden>Show more</button>' : ''}
                <div class="perm-note${role.notes[key] ? '' : ' is-empty'}">${noteHtml(role, key)}</div>
              </div>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────
// `remember` is only true when the user picks a theme themselves. Until they do, the app
// keeps following the system setting, including when it changes while the app is open.
function applyDarkMode(dark, remember = false) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('icon-moon').style.display = dark ? 'none' : '';
  document.getElementById('icon-sun').style.display  = dark ? ''     : 'none';
  const btn = document.getElementById('btn-dark-mode');
  btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-label', btn.title);
  if (remember) localStorage.setItem(DARK_MODE_KEY, dark ? '1' : '0');
}

function loadDarkMode() {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const saved  = localStorage.getItem(DARK_MODE_KEY);
  applyDarkMode(saved !== null ? saved === '1' : system.matches);
  system.addEventListener('change', e => {
    if (localStorage.getItem(DARK_MODE_KEY) === null) applyDarkMode(e.matches);
  });
}

// ── Main Render ───────────────────────────────────────────────────────────────
function render() { renderSidebar(); renderMainPanel(); }

// ── Sidebar Resize ────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH_KEY = 'intuneRbacSidebarWidth';
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 520;

function loadSidebarWidth() {
  const width = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10);
  if (!width) return;
  const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));
  document.getElementById('sidebar').style.width = clamped + 'px';
}

function initSidebarResize() {
  const handle  = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('sidebar');

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;

    handle.classList.add('resizing');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      const newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, startWidth + e.clientX - startX));
      sidebar.style.width = newWidth + 'px';
    }

    function onMouseUp() {
      handle.classList.remove('resizing');
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      if (sidebar.style.width) localStorage.setItem(SIDEBAR_WIDTH_KEY, Math.round(parseFloat(sidebar.style.width)));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });

  // Double-click the handle to go back to the default width
  handle.addEventListener('dblclick', () => {
    sidebar.style.width = '';
    localStorage.removeItem(SIDEBAR_WIDTH_KEY);
  });
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
function initShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (openMenuEl) closeMenu();
      else if (isDialogOpen()) closeDialog();
      else closeSidebar();
      return;
    }
    // "/" jumps to the permission search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)
        && !document.querySelector('.modal-overlay.open')) {
      const search = document.getElementById('perm-search');
      if (search) { e.preventDefault(); search.focus(); search.select(); }
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDarkMode();
  loadSidebarWidth();
  loadViewPrefs();
  loadState();
  loadGraphIds();

  initSidebarResize();
  initShortcuts();
  initDialog();

  document.getElementById('btn-dark-mode').addEventListener('click', () => {
    applyDarkMode(document.documentElement.getAttribute('data-theme') !== 'dark', true);
  });

  document.getElementById('btn-new-role').addEventListener('click',  () => createRole());
  document.getElementById('btn-new-role-menu').addEventListener('click', e => openNewRoleMenu(e.currentTarget));
  document.getElementById('btn-new-group').addEventListener('click', () => createGroup());

  document.getElementById('btn-compare').addEventListener('click',      () => openCompareDialog());
  document.getElementById('btn-find').addEventListener('click',         () => openFindDialog());
  document.getElementById('btn-export-excel').addEventListener('click', () => exportToExcel(roles));
  document.getElementById('btn-export-image').addEventListener('click', () => exportComparisonImage(roles));
  document.getElementById('btn-data').addEventListener('click',         () => openDataDialog());

  document.getElementById('btn-open-sidebar').addEventListener('click', openSidebar);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

  render();
  if (loadProblem) showToast(loadProblem, 'error', { label: 'OK', sticky: true, onClick: () => {} });
});
