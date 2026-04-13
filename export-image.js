function buildComparisonTable(roles) {
  const container = document.getElementById('comparison-render');
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Intune RBAC Role Comparison';
  container.appendChild(h2);

  const sub = document.createElement('p');
  sub.className = 'render-subtitle';
  sub.textContent = `Generated ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })} · ${roles.length} role${roles.length !== 1 ? 's' : ''}`;
  container.appendChild(sub);

  const table = document.createElement('table');

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const catTh = document.createElement('th');
  catTh.textContent = 'Category';
  catTh.style.width = '160px';
  headerRow.appendChild(catTh);

  const actionTh = document.createElement('th');
  actionTh.textContent = 'Permission';
  actionTh.style.width = '200px';
  headerRow.appendChild(actionTh);

  roles.forEach(role => {
    const th = document.createElement('th');
    th.className = 'role-col';
    th.textContent = role.name || 'Unnamed';
    th.style.maxWidth = '100px';
    th.style.wordBreak = 'break-word';
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');

  PERMISSIONS_DATA.forEach(cat => {
    // Only include categories that at least one role has selected
    const catIsUsed = roles.some(role =>
      cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
    );
    if (!catIsUsed) return;

    cat.permissions.forEach((perm, idx) => {
      const permIsUsed = roles.some(role => role.permissions.has(permKey(cat.category, perm.action)));
      if (!permIsUsed) return;

      const tr = document.createElement('tr');

      const catTd = document.createElement('td');
      catTd.className = 'cat-cell';
      catTd.textContent = idx === 0 ? cat.category : '';
      catTd.style.fontWeight = idx === 0 ? '600' : '400';
      if (idx !== 0) catTd.style.borderTop = 'none';
      tr.appendChild(catTd);

      const actionTd = document.createElement('td');
      actionTd.textContent = perm.action;
      tr.appendChild(actionTd);

      roles.forEach(role => {
        const td = document.createElement('td');
        td.className = 'check-cell';
        const selected = role.permissions.has(permKey(cat.category, perm.action));
        td.classList.add(selected ? 'yes' : 'no');
        td.textContent = selected ? '✓' : '—';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function exportComparisonImage(roles) {
  if (!roles || roles.length === 0) {
    showToast('No roles to compare.', 'error');
    return;
  }

  buildComparisonTable(roles);

  const container = document.getElementById('comparison-render');
  // Temporarily make visible for rendering
  container.style.left = '0';
  container.style.top = '0';
  container.style.position = 'fixed';
  container.style.zIndex = '-1';

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false
    });

    container.style.left = '-9999px';
    container.style.position = 'fixed';
    container.style.zIndex = 'auto';

    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `Intune-RBAC-Comparison-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Comparison image exported!', 'success');
  } catch (err) {
    container.style.left = '-9999px';
    console.error(err);
    showToast('Image export failed. Try fewer roles.', 'error');
  }
}
