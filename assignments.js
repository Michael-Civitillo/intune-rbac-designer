// ── Assignment planning ───────────────────────────────────────────────────────
// A role does nothing in Intune until it is assigned. Each assignment mirrors the pages of
// Intune's "Assign role" wizard: Admin Groups, Scope (Groups) and Scope (Tags).
// Nothing here is sent anywhere; it is documentation that travels with the exports.

// A small tag editor: type a name and press Enter. `values` is edited in place.
function renderChipInput(container, values, { label, placeholder, quick = [], onChange }) {
  function commit(text) {
    const added = text.split(/[,;\n]/).map(v => v.trim()).filter(v => v && !values.includes(v));
    if (!added.length) return false;
    values.push(...added);
    onChange();
    return true;
  }

  function draw(refocus) {
    const offers = quick.filter(q => !values.includes(q));
    container.innerHTML = `
      <div class="chip-input">
        ${values.map((v, i) => `<span class="chip">${escHtml(v)}<button type="button" class="chip-remove" data-index="${i}" aria-label="Remove ${escAttr(v)}">${icon(ICON.x, 10, 'stroke-width="3"')}</button></span>`).join('')}
        <input type="text" class="chip-text" maxlength="120" placeholder="${escAttr(values.length ? 'Add another' : placeholder)}" aria-label="${escAttr(label)}" autocomplete="off" spellcheck="false"/>
      </div>
      ${offers.length ? `<div class="chip-quick">${offers.map(q => `<button type="button" class="chip-suggest" data-value="${escAttr(q)}">${icon(ICON.plus, 10, 'stroke-width="3"')}${escHtml(q)}</button>`).join('')}</div>` : ''}`;

    const input = container.querySelector('.chip-text');
    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && input.value.trim()) {
        e.preventDefault();
        if (commit(input.value)) draw(true); else input.value = '';
      } else if (e.key === 'Backspace' && !input.value && values.length) {
        values.pop();
        onChange();
        draw(true);
      }
    });
    input.addEventListener('paste', e => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[,;\n]/.test(text)) return;
      e.preventDefault();
      if (commit(text)) draw(true);
    });
    // Leaving the box keeps whatever was typed. If focus is only moving to one of this
    // editor's own buttons, that button's handler takes care of it instead, so the button
    // is not redrawn out from under the click.
    input.addEventListener('blur', e => {
      if (container.contains(e.relatedTarget)) return;
      if (commit(input.value)) draw(false);
    });

    container.querySelector('.chip-input').addEventListener('click', e => {
      const remove = e.target.closest('.chip-remove');
      if (remove) {
        values.splice(Number(remove.dataset.index), 1);
        onChange();
        commit(input.value);
        draw(true);
      } else if (e.target === e.currentTarget) {
        input.focus();
      }
    });
    container.querySelectorAll('.chip-suggest').forEach(btn => {
      btn.addEventListener('click', () => {
        commit(input.value);
        commit(btn.dataset.value);
        draw(true);
      });
    });

    if (refocus) container.querySelector('.chip-text').focus();
  }

  draw(false);
}

function renderAssignmentsTab(body, role) {
  body.innerHTML = `
    <div class="assignments-pane" id="assignments-pane">
      <div class="inner">
        <div class="assign-intro">
          <h3>Who gets this role, and over what?</h3>
          <p>A role does nothing in Intune until it is assigned. Plan each assignment here: the admin groups that receive the role, the users and devices they may manage, and the scope tags that limit what they see. This is for your own documentation and exports; nothing is sent to Intune.</p>
        </div>
        <div id="assignment-list"></div>
        <div><button class="btn btn-secondary" id="btn-add-assignment">${icon(ICON.plus, 15, 'stroke-width="2.4"')} Add assignment</button></div>
      </div>
    </div>`;

  const list = document.getElementById('assignment-list');
  const changed = () => { saveState(); updateRoleIndicators(role); };

  function draw(focusId) {
    if (!role.assignments.length) {
      list.innerHTML = `<div class="assign-empty">${icon(ICON.users, 22, 'stroke-width="1.7"')}<span>No assignments planned yet.</span></div>`;
      return;
    }
    list.innerHTML = role.assignments.map((a, i) => `
      <section class="assign-card" data-id="${escAttr(a.id)}">
        <div class="assign-card-head">
          <input class="assign-name" type="text" maxlength="100" value="${escHtml(a.name)}" placeholder="Assignment name, for example EMEA service desk" aria-label="Assignment ${i + 1} name" autocomplete="off" spellcheck="false"/>
          <button class="icon-btn assign-delete" title="Remove this assignment" aria-label="Remove this assignment">${icon(ICON.trash, 15)}</button>
        </div>
        <div class="assign-field">
          <div class="assign-label">Admin Groups <span>Microsoft Entra groups whose members receive this role.</span></div>
          <div data-field="adminGroups"></div>
        </div>
        <div class="assign-field">
          <div class="assign-label">Scope (Groups) <span>The users and devices those admins are allowed to manage.</span></div>
          <div data-field="scopeGroups"></div>
        </div>
        <div class="assign-field">
          <div class="assign-label">Scope (Tags) <span>Admins only see objects that carry these tags.</span></div>
          <div data-field="scopeTags"></div>
        </div>
        <div class="assign-field">
          <div class="assign-label">Description <span>Optional.</span></div>
          <input class="assign-desc" type="text" maxlength="300" value="${escHtml(a.description)}" placeholder="Anything worth recording about this assignment" aria-label="Assignment ${i + 1} description" autocomplete="off"/>
        </div>
      </section>`).join('');

    role.assignments.forEach(a => {
      const card = list.querySelector(`.assign-card[data-id="${a.id}"]`);
      card.querySelector('.assign-name').addEventListener('input', e => { a.name = e.target.value; changed(); });
      card.querySelector('.assign-desc').addEventListener('input', e => { a.description = e.target.value; changed(); });
      card.querySelector('.assign-delete').addEventListener('click', () => removeAssignment(a.id));
      renderChipInput(card.querySelector('[data-field="adminGroups"]'), a.adminGroups,
        { label: 'Admin groups', placeholder: 'Type a group name and press Enter', onChange: changed });
      renderChipInput(card.querySelector('[data-field="scopeGroups"]'), a.scopeGroups,
        { label: 'Scope groups', placeholder: 'Type a group name and press Enter', quick: ['All users', 'All devices'], onChange: changed });
      renderChipInput(card.querySelector('[data-field="scopeTags"]'), a.scopeTags,
        { label: 'Scope tags', placeholder: 'Type a scope tag and press Enter', quick: ['Default'], onChange: changed });
    });

    if (focusId) list.querySelector(`.assign-card[data-id="${focusId}"] .assign-name`)?.focus();
  }

  function removeAssignment(id) {
    const index = role.assignments.findIndex(a => a.id === id);
    if (index < 0) return;
    const [removed] = role.assignments.splice(index, 1);
    changed();
    draw();
    showToast(`Assignment "${removed.name || 'Unnamed'}" removed.`, '', {
      label: 'Undo',
      onClick: () => {
        role.assignments.splice(Math.min(index, role.assignments.length), 0, removed);
        saveState();
        // The user may have moved to another role or tab since; redraw from scratch
        // rather than through this (possibly discarded) view.
        if (getActiveRole() === role) renderMainPanel();
        else updateSidebarRole(role);
      }
    });
  }

  document.getElementById('btn-add-assignment').addEventListener('click', () => {
    const assignment = makeAssignment();
    role.assignments.push(assignment);
    changed();
    draw(assignment.id);
  });

  draw();
}

// One line per assignment, used by the summary and the exports
function describeAssignment(a) {
  const list = v => (v.length ? v.join(', ') : 'none');
  return `${a.name || 'Unnamed assignment'}: admin groups ${list(a.adminGroups)}; scope groups ${list(a.scopeGroups)}; scope tags ${list(a.scopeTags)}`;
}
