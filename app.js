// ── State ─────────────────────────────────────────────────────────────────────
let roles             = [];   // [{ id, name, groupId, permissions: Set<string> }]
let groups            = [];   // [{ id, name, collapsed }]
let activeRoleId      = null;
let searchQuery       = '';
let filterMode        = 'all'; // 'all' | 'selected'
let showDescriptions  = true;
let toastTimer        = null;
let dragState         = null; // { roleId, ghost, sourceEl }
let suppressNextClick = false; // eat the click that follows a completed drag

const STORAGE_KEY   = 'intuneRbacRoles';
const DARK_MODE_KEY = 'intuneRbacDarkMode';
const SHOW_DESC_KEY = 'intuneRbacShowDescriptions';

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
  summary: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>',
  copy:    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  trash:   '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>',
  pencil:  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  alert:   '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  layers:  '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  expand:  '<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>',
  collapse:'<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>',
};
const FOLDER_ICON = (size = 14, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function permKey(category, action) { return `${category}||${action}`; }

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

// ── Persistence ───────────────────────────────────────────────────────────────
function saveState() {
  const data = {
    version: 2,
    groups,
    roles: roles.map(r => ({
      id: r.id, name: r.name,
      groupId: r.groupId || null,
      permissions: Array.from(r.permissions)
    }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Carry selections across renamed permissions (see PERMISSION_RENAMES)
function migratePermissions(keys) {
  const perms = new Set(keys);
  PERMISSION_RENAMES.forEach(({ category, from, to }) => {
    if (perms.delete(permKey(category, from))) perms.add(permKey(category, to));
  });
  return perms;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    // Backward-compat: old format was a plain array of roles
    if (Array.isArray(data)) {
      roles  = data.map(r => ({ id: r.id, name: r.name, groupId: null, permissions: migratePermissions(r.permissions) }));
      groups = [];
    } else {
      groups = (data.groups || []).map(g => ({ id: g.id, name: g.name, collapsed: !!g.collapsed }));
      roles  = (data.roles  || []).map(r => ({ id: r.id, name: r.name, groupId: r.groupId || null, permissions: migratePermissions(r.permissions) }));
    }

    if (roles.length > 0) activeRoleId = roles[0].id;
  } catch { roles = []; groups = []; }
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
  toastTimer = setTimeout(hideToast, action ? 8000 : 3000);
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
function createRole(name = 'New Role', groupId = null) {
  const role = { id: uid(), name, groupId, permissions: new Set() };
  // If a group is specified, insert after last role in that group; otherwise append
  if (groupId) {
    const lastIdx = roles.reduce((acc, r, i) => r.groupId === groupId ? i : acc, -1);
    if (lastIdx >= 0) { roles.splice(lastIdx + 1, 0, role); }
    else roles.push(role);
  } else {
    roles.push(role);
  }
  activeRoleId = role.id;
  // A new role has nothing selected and nothing to search for yet — start from the full list
  searchQuery = '';
  filterMode  = 'all';
  saveState();
  render();
  closeSidebar();
  setTimeout(() => {
    const input = document.querySelector('.role-name-input');
    if (input) { input.focus(); input.select(); }
  }, 50);
  return role;
}

function duplicateRole(id) {
  const src = roles.find(r => r.id === id);
  if (!src) return;
  const copy = { id: uid(), name: `${src.name} (Copy)`, groupId: src.groupId, permissions: new Set(src.permissions) };
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

function getPermDescription(category, action) {
  return PERMISSIONS_DATA.find(c => c.category === category)
    ?.permissions.find(p => p.action === action)?.description || '';
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
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
    }
    function onOk()     { if (dontShow.checked) suppressDestructiveWarnings = true; cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    function onBackdrop(e) { if (e.target === modal) onCancel(); }
    function onKey(e)      { if (e.key === 'Escape') onCancel(); }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    modal.classList.add('open');
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
  updatePermStats();
  updateSidebarCount(role);
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
  updatePermStats();
  updateSidebarCount(role);
  renderCategoryCheckboxes(category);
  updateCategoryHeader(category);
}

// ── Summary Modal ─────────────────────────────────────────────────────────────
function openSummaryModal(role) {
  const modal = document.getElementById('summary-modal');
  document.getElementById('summary-title').textContent = role.name || 'Unnamed role';

  const totalSelected = role.permissions.size;
  const highImpact    = [...role.permissions].filter(k => DESTRUCTIVE_PERMISSIONS.has(k)).length;
  const catsUsed      = PERMISSIONS_DATA.filter(cat =>
    cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
  );
  const group = groups.find(g => g.id === role.groupId);

  document.getElementById('summary-body').innerHTML = `
    <div class="summary-stats">
      <div class="stat-card"><div class="stat-num">${totalSelected}</div><div class="stat-label">${totalSelected === 1 ? 'Permission' : 'Permissions'}</div></div>
      <div class="stat-card"><div class="stat-num">${catsUsed.length}</div><div class="stat-label">${catsUsed.length === 1 ? 'Category' : 'Categories'}</div></div>
      <div class="stat-card${highImpact ? ' warn' : ''}"><div class="stat-num">${highImpact}</div><div class="stat-label">High impact</div></div>
    </div>
    ${group ? `<p class="summary-folder">${FOLDER_ICON(13)} ${escHtml(group.name)}</p>` : ''}
    ${totalSelected === 0 ? '<p class="summary-empty">No permissions selected for this role yet.</p>' : ''}
    ${catsUsed.length > 0 ? `
    <div class="summary-section">
      <h3>Selected permissions by category</h3>
      ${catsUsed.map(cat => {
        const selected = cat.permissions.filter(p => role.permissions.has(permKey(cat.category, p.action)));
        return `<div class="summary-cat">
          <div class="summary-cat-name">${escHtml(cat.category)}<span class="summary-cat-count">${selected.length} of ${cat.permissions.length}</span></div>
          <div class="summary-perms">${selected.map(p =>
            `<span class="perm-chip${isDestructive(cat.category, p.action) ? ' warn' : ''}">${escHtml(p.action)}</span>`).join('')}</div>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
  modal.classList.add('open');
  document.getElementById('summary-modal-close-btn').focus();
}

function closeSummaryModal() { document.getElementById('summary-modal').classList.remove('open'); }

// ── Render Helpers ────────────────────────────────────────────────────────────
function countCategoriesUsed(role) {
  return PERMISSIONS_DATA.filter(cat =>
    cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
  ).length;
}

function updatePermStats() {
  const role = getActiveRole();
  const el   = document.getElementById('perm-stats');
  if (!el || !role) return;
  const count = role.permissions.size;
  const cats  = countCategoriesUsed(role);
  el.innerHTML = `<strong>${count}</strong> of ${TOTAL_PERMISSIONS} permissions selected` +
    (count ? ` <span class="meta-sep">·</span> ${plural(cats, 'category', 'categories')}` : '');
  const seg = document.getElementById('seg-selected-count');
  if (seg) seg.textContent = count;
}

function updateSidebarCount(role) {
  const el = document.querySelector(`.role-item[data-id="${role.id}"] .role-count`);
  if (el) el.textContent = role.permissions.size;
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

// ── Filtering ─────────────────────────────────────────────────────────────────
function applyFilter() {
  const pane = document.getElementById('permissions-pane');
  const role = getActiveRole();
  if (!pane || !role) return;

  const q            = searchQuery.toLowerCase().trim();
  const selectedOnly = filterMode === 'selected';
  let shown = 0;

  pane.querySelectorAll('.category-block').forEach(block => {
    const cat        = block.dataset.cat;
    const catMatches = !!q && cat.toLowerCase().includes(q);
    let visible = 0;

    block.querySelectorAll('.perm-row').forEach(row => {
      const action = row.dataset.action, desc = row.dataset.desc;
      const textOk = !q || catMatches
        || action.toLowerCase().includes(q)
        || desc.toLowerCase().includes(q);
      const selOk  = !selectedOnly || role.permissions.has(permKey(cat, action));
      const ok     = textOk && selOk;
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
  const filtering = !!q || selectedOnly;
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
    const nothingSelected = selectedOnly && !q && role.permissions.size === 0;
    empty.querySelector('h3').textContent = nothingSelected
      ? 'Nothing selected yet'
      : 'No permissions found';
    empty.querySelector('p').textContent = nothingSelected
      ? 'This role has no permissions. Switch back to All to start adding some.'
      : selectedOnly
        ? `None of this role's selected permissions match "${searchQuery.trim()}".`
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
      <button class="btn btn-primary btn-lg" id="btn-empty-new-role">${icon(ICON.plus, 16, 'stroke-width="2.4"')} New Role</button>
      <ol class="empty-steps">
        <li><span class="step-num">1</span>Name the role</li>
        <li><span class="step-num">2</span>Tick the permissions it needs</li>
        <li><span class="step-num">3</span>Export to Excel or an image</li>
      </ol>
    </div>`;
  document.getElementById('btn-empty-new-role').addEventListener('click', () => createRole());
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
            <div class="role-meta">
              <label class="folder-chip" title="Move to folder">
                ${FOLDER_ICON(13)}
                <select id="role-group-select" class="role-group-select" aria-label="Folder">${groupOptionsHtml(role)}</select>
              </label>
              <span class="meta-sep">·</span>
              <div class="perm-stats" id="perm-stats"></div>
            </div>
          </div>
          <div class="role-editor-actions">
            <button class="btn btn-secondary" id="btn-summary">${icon(ICON.summary, 15)} Summary</button>
            <button class="btn btn-secondary" id="btn-clone">${icon(ICON.copy, 15)} Clone</button>
            <button class="btn btn-danger" id="btn-delete">${icon(ICON.trash, 15)} Delete</button>
          </div>
        </div>
      </div>

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
          ${renderPermissionCategories(role)}
          <div class="no-results" id="no-results" hidden>
            ${icon(ICON.search, 30, 'stroke-width="1.6"')}
            <h3></h3>
            <p></p>
            <button class="btn btn-secondary btn-sm" id="btn-clear-filters"></button>
          </div>
        </div>
      </div>
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
  });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') nameInput.blur();
  });

  document.getElementById('role-group-select').addEventListener('change', e => {
    moveRoleToGroup(role.id, e.target.value);
  });

  document.getElementById('btn-summary').addEventListener('click', () => openSummaryModal(role));
  document.getElementById('btn-clone').addEventListener('click',   () => duplicateRole(role.id));
  document.getElementById('btn-delete').addEventListener('click',  () => deleteRole(role.id));

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

  panel.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', () => { filterMode = btn.dataset.filter; applyFilter(); });
  });
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

  document.getElementById('toggle-descriptions').addEventListener('change', e => {
    showDescriptions = e.target.checked;
    localStorage.setItem(SHOW_DESC_KEY, showDescriptions ? '1' : '0');
    document.getElementById('permissions-pane').classList.toggle('hide-descriptions', !showDescriptions);
  });

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    panel.querySelectorAll('.category-block').forEach(b => setCategoryCollapsed(b, false));
  });
  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    panel.querySelectorAll('.category-block').forEach(b => setCategoryCollapsed(b, true));
  });

  // ── Categories ──
  panel.querySelectorAll('.category-toggle-all').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleCategory(btn.dataset.cat); });
  });

  panel.querySelectorAll('.category-header').forEach(header => {
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
  panel.querySelectorAll('.perm-row input[type="checkbox"]').forEach(cb => {
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

  clampObserver.disconnect();
  panel.querySelectorAll('.perm-desc.is-long').forEach(desc => clampObserver.observe(desc));

  panel.querySelectorAll('.perm-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.perm-row');
      const expanded = row.classList.toggle('expanded');
      btn.textContent = expanded ? 'Show less' : 'Show more';
      btn.setAttribute('aria-expanded', String(expanded));
      if (!expanded) btn.hidden = !isClamped(row.querySelector('.perm-desc'));
    });
  });

  // With descriptions hidden, the full text is still one hover away
  panel.querySelectorAll('.perm-label').forEach(label => {
    const desc = label.closest('.perm-row').dataset.desc;
    label.addEventListener('mouseenter', e => { if (!showDescriptions) showTooltip(desc, e); });
    label.addEventListener('mouseleave', hideTooltip);
  });

  hideTooltip();
  updatePermStats();
  applyFilter();
}

function renderPermissionCategories(role) {
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
            const checked = role.permissions.has(permKey(cat.category, perm.action));
            const isLong  = perm.description.length > CLAMP_FROM;
            const flag    = isDestructive(cat.category, perm.action)
              ? `<span class="perm-flag" title="You'll be asked to confirm before this is added">${icon(ICON.alert, 11, 'stroke-width="2.4"')}High impact</span>`
              : '';
            return `
              <div class="perm-row${checked ? ' selected' : ''}" data-cat="${escAttr(cat.category)}" data-action="${escAttr(perm.action)}" data-desc="${escAttr(perm.description)}">
                <label class="perm-label">
                  <input type="checkbox" ${checked ? 'checked' : ''}/>
                  <span class="perm-main">
                    <span class="perm-title"><span class="perm-action">${escHtml(perm.action)}</span>${flag}</span>
                    <span class="perm-desc${isLong ? ' is-long' : ''}">${escHtml(perm.description)}</span>
                  </span>
                </label>
                ${isLong ? '<button type="button" class="perm-more" aria-expanded="false" hidden>Show more</button>' : ''}
              </div>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────
function applyDarkMode(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('icon-moon').style.display = dark ? 'none' : '';
  document.getElementById('icon-sun').style.display  = dark ? ''     : 'none';
  const btn = document.getElementById('btn-dark-mode');
  btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-label', btn.title);
  localStorage.setItem(DARK_MODE_KEY, dark ? '1' : '0');
}

function loadDarkMode() {
  const saved = localStorage.getItem(DARK_MODE_KEY);
  const prefersDark = saved !== null ? saved === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDarkMode(prefersDark);
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
      if (document.getElementById('summary-modal').classList.contains('open')) closeSummaryModal();
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

  initSidebarResize();
  initShortcuts();

  document.getElementById('btn-dark-mode').addEventListener('click', () => {
    applyDarkMode(document.documentElement.getAttribute('data-theme') !== 'dark');
  });

  document.getElementById('btn-new-role').addEventListener('click',     () => createRole());
  document.getElementById('btn-new-group').addEventListener('click',    () => createGroup());
  document.getElementById('btn-export-excel').addEventListener('click', () => exportToExcel(roles));
  document.getElementById('btn-export-image').addEventListener('click', () => exportComparisonImage(roles));

  document.getElementById('btn-open-sidebar').addEventListener('click', openSidebar);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

  document.getElementById('summary-modal-close').addEventListener('click',     closeSummaryModal);
  document.getElementById('summary-modal-close-btn').addEventListener('click', closeSummaryModal);
  document.getElementById('summary-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('summary-modal')) closeSummaryModal();
  });

  render();
});
