function exportToExcel(roles) {
  if (!roles || roles.length === 0) {
    showToast('No roles to export.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();

  roles.forEach(role => {
    const rows = [['Category', 'Action', 'Description', 'Selected']];

    PERMISSIONS_DATA.forEach(cat => {
      cat.permissions.forEach(perm => {
        const key = permKey(cat.category, perm.action);
        const selected = role.permissions.has(key);
        rows.push([cat.category, perm.action, perm.description, selected ? 'Yes' : '']);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 40 },
      { wch: 38 },
      { wch: 80 },
      { wch: 10 }
    ];

    // Style header row (SheetJS CE supports basic cell styles via write options)
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: '0F3460' } } };
    ['A1','B1','C1','D1'].forEach(ref => {
      if (ws[ref]) ws[ref].s = headerStyle;
    });

    // Highlight selected rows
    let rowIdx = 1; // 0-indexed, row 0 = header
    PERMISSIONS_DATA.forEach(cat => {
      cat.permissions.forEach(perm => {
        rowIdx++;
        const key = permKey(cat.category, perm.action);
        if (role.permissions.has(key)) {
          const refs = ['A','B','C','D'].map(c => `${c}${rowIdx}`);
          refs.forEach(ref => {
            if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: 'D5F5E3' } } };
          });
        }
      });
    });

    // Safe sheet name (Excel max 31 chars, no special chars)
    const sheetName = (role.name || 'Unnamed Role')
      .replace(/[:\\\/\?\*\[\]]/g, '')
      .substring(0, 31) || 'Role';

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Summary sheet
  const summaryRows = [['Role Name', 'Total Permissions Selected', 'Categories With Permissions']];
  roles.forEach(role => {
    const catCount = PERMISSIONS_DATA.filter(cat =>
      cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
    ).length;
    summaryRows.push([role.name || 'Unnamed', role.permissions.size, catCount]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 35 }, { wch: 28 }, { wch: 28 }];
  ['A1','B1','C1'].forEach(ref => {
    if (summaryWs[ref]) summaryWs[ref].s = { font: { bold: true } };
  });

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Intune-RBAC-Roles-${date}.xlsx`);
  showToast('Excel file exported successfully!', 'success');
}
