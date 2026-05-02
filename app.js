// ── State ─────────────────────────────────────────────────────────────────────
let roles             = [];   // [{ id, name, groupId, permissions: Set<string> }]
let groups            = [];   // [{ id, name, collapsed }]
let activeRoleId      = null;
let searchQuery       = '';
let toastTimer        = null;
let dragState         = null; // { roleId, ghost, sourceEl }
let suppressNextClick = false; // eat the click that follows a completed drag

const STORAGE_KEY   = 'intuneRbacRoles';
const DARK_MODE_KEY = 'intuneRbacDarkMode';

// ── Helpers ───────────────────────────────────────────────────────────────────
function permKey(category, action) { return `${category}||${action}`; }

function uid() { return Math.random().toString(36).slice(2, 10); }

function initials(name) {
  return (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    // Backward-compat: old format was a plain array of roles
    if (Array.isArray(data)) {
      roles  = data.map(r => ({ id: r.id, name: r.name, groupId: null, permissions: new Set(r.permissions) }));
      groups = [];
    } else {
      groups = (data.groups || []).map(g => ({ id: g.id, name: g.name, collapsed: !!g.collapsed }));
      roles  = (data.roles  || []).map(r => ({ id: r.id, name: r.name, groupId: r.groupId || null, permissions: new Set(r.permissions) }));
    }

    if (roles.length > 0) activeRoleId = roles[0].id;
  } catch { roles = []; groups = []; }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

function showTooltip(text, e) { tooltip.textContent = text; positionTooltip(e); tooltip.classList.add('visible'); }
function hideTooltip()        { tooltip.classList.remove('visible'); }

function positionTooltip(e) {
  const pad = 12, tw = 320;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - pad;
  if (y + 120 > window.innerHeight) y = e.clientY - 120 - pad;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

document.addEventListener('mousemove', e => { if (tooltip.classList.contains('visible')) positionTooltip(e); });

// ── Group Operations ──────────────────────────────────────────────────────────
function createGroup(name = 'New Folder') {
  const group = { id: uid(), name, collapsed: false };
  groups.push(group);
  saveState();
  renderSidebar();
  // Trigger inline rename immediately
  setTimeout(() => startRenameGroup(group.id), 30);
}

function deleteGroup(id) {
  const group = groups.find(g => g.id === id);
  if (!group) return;
  const count = roles.filter(r => r.groupId === id).length;
  const msg = count > 0
    ? `Delete folder "${group.name}"? The ${count} role${count > 1 ? 's' : ''} inside will move to No Folder.`
    : `Delete folder "${group.name}"?`;
  if (!confirm(msg)) return;
  roles.forEach(r => { if (r.groupId === id) r.groupId = null; });
  groups = groups.filter(g => g.id !== id);
  saveState();
  renderSidebar();
  showToast(`Folder "${group.name}" deleted.`);
}

function renameGroup(id, name) {
  const group = groups.find(g => g.id === id);
  if (!group) return;
  group.name = name.trim() || group.name;
  saveState();
  renderSidebar();
  // If the active role is in this group, refresh editor header to update selector
  const role = getActiveRole();
  if (role && role.groupId === id) {
    const sel = document.getElementById('role-group-select');
    if (sel) {
      const opt = sel.querySelector(`option[value="${id}"]`);
      if (opt) opt.textContent = group.name;
    }
  }
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

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newName = input.value.trim() || original;
    renameGroup(id, newName);
  }

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
  saveState();
  render();
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
  showToast(`"${src.name}" duplicated.`);
}

function deleteRole(id) {
  const role = roles.find(r => r.id === id);
  if (!role) return;
  if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
  roles = roles.filter(r => r.id !== id);
  if (activeRoleId === id) activeRoleId = roles.length > 0 ? roles[0].id : null;
  saveState();
  render();
  showToast(`"${role.name}" deleted.`);
}

function getActiveRole() { return roles.find(r => r.id === activeRoleId) || null; }

// ── Destructive Permission Confirmation ───────────────────────────────────────
const DESTRUCTIVE_PERMISSIONS = new Set([
  permKey('Managed devices',  'Delete'),
  permKey('Managed apps',     'Wipe'),
  permKey('Remote tasks',     'Wipe'),
  permKey('Remote tasks',     'Retire'),
  permKey('Remote tasks',     'Reset passcode'),
  permKey('Remote tasks',     'Disable lost mode'),
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
  document.getElementById('summary-title').textContent = `Role Summary: ${role.name || 'Unnamed'}`;

  const totalSelected  = role.permissions.size;
  const totalAvailable = PERMISSIONS_DATA.reduce((n, c) => n + c.permissions.length, 0);
  const catsUsed       = PERMISSIONS_DATA.filter(cat =>
    cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
  );
  const group = groups.find(g => g.id === role.groupId);

  document.getElementById('summary-body').innerHTML = `
    <div class="summary-stats">
      <div class="stat-card"><div class="stat-num">${totalSelected}</div><div class="stat-label">Permissions</div></div>
      <div class="stat-card"><div class="stat-num">${catsUsed.length}</div><div class="stat-label">Categories</div></div>
      <div class="stat-card"><div class="stat-num">${totalAvailable}</div><div class="stat-label">Available</div></div>
    </div>
    ${group ? `<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      ${escHtml(group.name)}</p>` : ''}
    ${totalSelected === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px 0;">No permissions selected for this role.</p>' : ''}
    ${catsUsed.length > 0 ? `
    <div class="summary-section">
      <h3>Selected Permissions by Category</h3>
      ${catsUsed.map(cat => {
        const selected = cat.permissions.filter(p => role.permissions.has(permKey(cat.category, p.action)));
        return `<div class="summary-cat">
          <div class="summary-cat-name">${escHtml(cat.category)}</div>
          <div class="summary-perms">${selected.map(p => `<span class="perm-chip">${escHtml(p.action)}</span>`).join('')}</div>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
  modal.classList.add('open');
}

function closeSummaryModal() { document.getElementById('summary-modal').classList.remove('open'); }

// ── Render Helpers ────────────────────────────────────────────────────────────
function updatePermStats() {
  const role = getActiveRole();
  const el   = document.getElementById('perm-stats');
  if (!el) return;
  const count = role ? role.permissions.size : 0;
  const total = PERMISSIONS_DATA.reduce((n, c) => n + c.permissions.length, 0);
  el.innerHTML = `<strong>${count}</strong> of ${total} permissions selected`;
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
  block.querySelector('.category-header').classList.toggle('has-selected', hasSelected);
  const badge = block.querySelector('.category-badge');
  badge.textContent = hasSelected ? `${selCount}/${total}` : total;
  badge.classList.toggle('has-selected', hasSelected);
  const toggleBtn = block.querySelector('.category-toggle-all');
  if (toggleBtn) toggleBtn.textContent = selCount === total ? 'None' : 'All';
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

// ── Filtering ─────────────────────────────────────────────────────────────────
function applyFilter() {
  const q = searchQuery.toLowerCase().trim();
  document.querySelectorAll('.category-block').forEach(block => {
    const cat = block.dataset.cat;
    let catVisible = false;
    block.querySelectorAll('.perm-row').forEach(row => {
      const matches = !q
        || row.dataset.action.toLowerCase().includes(q)
        || row.dataset.desc.toLowerCase().includes(q)
        || cat.toLowerCase().includes(q);
      row.classList.toggle('hidden-filter', !matches);
      if (matches) catVisible = true;
    });
    block.classList.toggle('hidden', !catVisible);
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
        `<div class="role-icon" style="width:24px;height:24px;font-size:10px;flex-shrink:0">${initials(role ? role.name : '?')}</div>` +
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
  const item = document.createElement('div');
  item.className = `role-item${role.id === activeRoleId ? ' active' : ''}`;
  item.dataset.id = role.id;
  item.innerHTML = `
    <div class="drag-handle" title="Drag to move">
      <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="3" cy="3"  r="1.5"/><circle cx="7" cy="3"  r="1.5"/>
        <circle cx="3" cy="8"  r="1.5"/><circle cx="7" cy="8"  r="1.5"/>
        <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
      </svg>
    </div>
    <div class="role-icon">${initials(role.name)}</div>
    <div class="role-name" title="${escHtml(role.name)}">${escHtml(role.name)}</div>
    <div class="role-count">${role.permissions.size}</div>
  `;

  // Click to select
  item.addEventListener('click', e => {
    if (suppressNextClick) return; // eat post-drag browser click
    if (e.target.closest('.drag-handle')) return;
    activeRoleId = role.id;
    render();
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

  const hasAnyContent = roles.length > 0 || groups.length > 0;
  if (!hasAnyContent) {
    list.innerHTML = '<p style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center;">No roles yet.<br>Create one to get started.</p>';
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
    header.innerHTML = `
      <svg class="group-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <svg class="group-folder-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
      <span class="group-name" data-group-id="${group.id}">${escHtml(group.name)}</span>
      <span class="group-count">${groupRoles.length}</span>
      <div class="group-actions">
        <button class="group-add-btn" data-group-id="${group.id}" title="Add role to this folder">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="group-delete-btn" data-group-id="${group.id}" title="Delete folder">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    `;

    // Collapse toggle (click anywhere on header except action buttons)
    header.addEventListener('click', e => {
      if (e.target.closest('.group-actions')) return;
      if (e.target.closest('.group-name')) return;
      toggleGroupCollapse(group.id);
    });

    // Double-click group name to rename
    header.querySelector('.group-name').addEventListener('dblclick', e => {
      e.stopPropagation();
      startRenameGroup(group.id);
    });

    // Add role to group
    header.querySelector('.group-add-btn').addEventListener('click', e => {
      e.stopPropagation();
      createRole('New Role', group.id);
    });

    // Delete group
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
function renderMainPanel() {
  const panel = document.getElementById('main-panel');
  const role  = getActiveRole();

  if (!role) {
    panel.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        <h3>No Role Selected</h3>
        <p>Create a new role to get started.</p>
      </div>`;
    return;
  }

  const groupOptions = groups.map(g =>
    `<option value="${escAttr(g.id)}"${role.groupId === g.id ? ' selected' : ''}>${escHtml(g.name)}</option>`
  ).join('');

  panel.innerHTML = `
    <div class="role-editor">
      <div class="role-editor-header">
        <div class="role-header-left">
          <input class="role-name-input" type="text" value="${escHtml(role.name)}"
            placeholder="Enter role name..." id="role-name-input" maxlength="100"/>
          <div class="role-folder-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="role-folder-icon">
              <path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            </svg>
            <select id="role-group-select" class="role-group-select">
              <option value=""${!role.groupId ? ' selected' : ''}>No folder</option>
              ${groupOptions}
            </select>
          </div>
        </div>
        <div class="role-editor-actions">
          <button class="btn btn-secondary btn-sm" id="btn-summary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Summary
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-clone">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Clone
          </button>
          <button class="btn btn-danger btn-sm" id="btn-delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Delete
          </button>
        </div>
      </div>

      <div class="perm-toolbar">
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" type="text" placeholder="Search permissions..."
            id="perm-search" value="${escHtml(searchQuery)}"/>
        </div>
        <div class="perm-stats" id="perm-stats"></div>
        <button class="btn btn-secondary btn-sm" id="btn-expand-all">Expand All</button>
        <button class="btn btn-secondary btn-sm" id="btn-collapse-all">Collapse All</button>
      </div>

      <div class="permissions-pane" id="permissions-pane">
        ${renderPermissionCategories(role)}
      </div>
    </div>`;

  // ── Wire events ──
  document.getElementById('role-name-input').addEventListener('input', e => {
    role.name = e.target.value;
    saveState();
    updateSidebarCount(role);
    const nameEl = document.querySelector(`.role-item[data-id="${role.id}"] .role-name`);
    const iconEl = document.querySelector(`.role-item[data-id="${role.id}"] .role-icon`);
    if (nameEl) nameEl.textContent = role.name;
    if (iconEl) iconEl.textContent = initials(role.name);
  });

  document.getElementById('role-group-select').addEventListener('change', e => {
    moveRoleToGroup(role.id, e.target.value);
  });

  document.getElementById('btn-summary').addEventListener('click', () => openSummaryModal(role));
  document.getElementById('btn-clone').addEventListener('click',   () => duplicateRole(role.id));
  document.getElementById('btn-delete').addEventListener('click',  () => deleteRole(role.id));

  document.getElementById('perm-search').addEventListener('input', e => {
    searchQuery = e.target.value;
    applyFilter();
  });

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.category-block').forEach(b => b.classList.remove('collapsed'));
  });
  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.category-block').forEach(b => b.classList.add('collapsed'));
  });

  document.querySelectorAll('.category-toggle-all').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleCategory(btn.dataset.cat); });
  });

  document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('.category-toggle-all')) return;
      header.closest('.category-block').classList.toggle('collapsed');
    });
  });

  document.querySelectorAll('.perm-row input[type="checkbox"]').forEach(cb => {
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

  document.querySelectorAll('.perm-label').forEach(label => {
    const desc = label.closest('.perm-row').dataset.desc;
    label.addEventListener('mouseenter', e => showTooltip(desc, e));
    label.addEventListener('mouseleave', hideTooltip);
  });

  updatePermStats();
  applyFilter();
}

function renderPermissionCategories(role) {
  return PERMISSIONS_DATA.map(cat => {
    const selCount = cat.permissions.filter(p => role.permissions.has(permKey(cat.category, p.action))).length;
    const hasSelected = selCount > 0;
    const total = cat.permissions.length;
    return `
      <div class="category-block${hasSelected ? '' : ' collapsed'}" data-cat="${escAttr(cat.category)}">
        <div class="category-header${hasSelected ? ' has-selected' : ''}">
          <svg class="category-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="category-name">${escHtml(cat.category)}</span>
          <span class="category-badge${hasSelected ? ' has-selected' : ''}">${hasSelected ? `${selCount}/${total}` : total}</span>
          <button class="category-toggle-all" data-cat="${escAttr(cat.category)}">${selCount === total ? 'None' : 'All'}</button>
        </div>
        <div class="category-body">
          ${cat.permissions.map(perm => {
            const key     = permKey(cat.category, perm.action);
            const checked = role.permissions.has(key);
            return `
              <div class="perm-row${checked ? ' selected' : ''}" data-cat="${escAttr(cat.category)}" data-action="${escAttr(perm.action)}" data-desc="${escAttr(perm.description)}">
                <input type="checkbox" ${checked ? 'checked' : ''}/>
                <label class="perm-label"><div class="perm-action">${escHtml(perm.action)}</div></label>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────
function applyDarkMode(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('icon-moon').style.display = dark ? 'none' : '';
  document.getElementById('icon-sun').style.display  = dark ? ''     : 'none';
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
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 520;

function loadSidebarWidth() {
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (!saved) return;
  const width = parseInt(saved, 10);
  if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
    document.getElementById('sidebar').style.width = width + 'px';
  }
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
      localStorage.setItem(SIDEBAR_WIDTH_KEY, Math.round(parseFloat(sidebar.style.width)));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDarkMode();
  loadSidebarWidth();
  loadState();

  initSidebarResize();

  document.getElementById('btn-dark-mode').addEventListener('click', () => {
    applyDarkMode(document.documentElement.getAttribute('data-theme') !== 'dark');
  });

  document.getElementById('btn-new-role').addEventListener('click',         () => createRole());
  document.getElementById('btn-new-role-sidebar').addEventListener('click', () => createRole());
  document.getElementById('btn-new-group').addEventListener('click',        () => createGroup());
  document.getElementById('btn-export-excel').addEventListener('click',     () => exportToExcel(roles));
  document.getElementById('btn-export-image').addEventListener('click',     () => exportComparisonImage(roles));

  document.getElementById('summary-modal-close').addEventListener('click',     closeSummaryModal);
  document.getElementById('summary-modal-close-btn').addEventListener('click', closeSummaryModal);
  document.getElementById('summary-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('summary-modal')) closeSummaryModal();
  });

  render();
});
