// Excel sheet names: 31 characters at most, none of : \ / ? * [ ], no apostrophe at either
// end, not "History" (Excel reserves it), and no two alike
function uniqueSheetName(name, taken) {
  const trimQuotes = text => text.replace(/^['\s]+|['\s]+$/g, '');
  let base = trimQuotes(trimQuotes((name || 'Unnamed Role').replace(/[:\\\/\?\*\[\]]/g, '')).substring(0, 31)) || 'Role';
  if (base.toLowerCase() === 'history') base = 'History role';
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    candidate = base.substring(0, 31 - suffix.length) + suffix;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function exportToExcel(roles) {
  if (!roles || roles.length === 0) {
    showToast('No roles to export.', 'error');
    return;
  }
  try {
    buildAndSaveWorkbook(roles);
    showToast('Excel file exported successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast("The Excel file couldn't be created. Nothing was exported.", 'error');
  }
}

function buildAndSaveWorkbook(roles) {

  const wb = XLSX.utils.book_new();
  // "Summary" and "Assignments" are this workbook's own sheets
  const taken = new Set(['summary', 'assignments']);
  const bold = { font: { bold: true } };

  roles.forEach(role => {
    const notes = role.notes || {};
    const rows = [['Category', 'Action', 'Description', 'Selected', 'Notes']];

    PERMISSIONS_DATA.forEach(cat => {
      cat.permissions.forEach(perm => {
        const key = permKey(cat.category, perm.action);
        const selected = role.permissions.has(key);
        rows.push([cat.category, perm.action, perm.description, selected ? 'Yes' : '', selected ? (notes[key] || '') : '']);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 40 },
      { wch: 38 },
      { wch: 80 },
      { wch: 10 },
      { wch: 50 }
    ];

    // Style header row (SheetJS CE supports basic cell styles via write options)
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: '0F3460' } } };
    ['A1','B1','C1','D1','E1'].forEach(ref => {
      if (ws[ref]) ws[ref].s = headerStyle;
    });

    // Highlight selected rows
    let rowIdx = 1; // 0-indexed, row 0 = header
    PERMISSIONS_DATA.forEach(cat => {
      cat.permissions.forEach(perm => {
        rowIdx++;
        const key = permKey(cat.category, perm.action);
        if (role.permissions.has(key)) {
          const refs = ['A','B','C','D','E'].map(c => `${c}${rowIdx}`);
          refs.forEach(ref => {
            if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: 'D5F5E3' } } };
          });
        }
      });
    });

    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(role.name, taken));
  });

  // Planned assignments, one row each
  const assignmentRows = [['Role Name', 'Assignment', 'Admin Groups', 'Scope (Groups)', 'Scope (Tags)', 'Description']];
  roles.forEach(role => {
    (role.assignments || []).forEach(a => {
      assignmentRows.push([role.name || 'Unnamed', a.name || 'Unnamed assignment',
        a.adminGroups.join(', '), a.scopeGroups.join(', '), a.scopeTags.join(', '), a.description || '']);
    });
  });
  if (assignmentRows.length > 1) {
    const assignWs = XLSX.utils.aoa_to_sheet(assignmentRows);
    assignWs['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 50 }];
    ['A1','B1','C1','D1','E1','F1'].forEach(ref => { if (assignWs[ref]) assignWs[ref].s = bold; });
    XLSX.utils.book_append_sheet(wb, assignWs, 'Assignments');
  }

  // Summary sheet
  const summaryRows = [['Role Name', 'Total Permissions Selected', 'Categories With Permissions', 'High Impact Permissions', 'Things To Check', 'Planned Assignments', 'Folder', 'Description']];
  roles.forEach(role => {
    const catCount = PERMISSIONS_DATA.filter(cat =>
      cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
    ).length;
    const folder = groups.find(g => g.id === role.groupId);
    summaryRows.push([
      role.name || 'Unnamed', role.permissions.size, catCount,
      highImpactKeys(role).length, runChecks(role, roles).length, (role.assignments || []).length,
      folder ? folder.name : '', role.description || ''
    ]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 35 }, { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 60 }];
  ['A1','B1','C1','D1','E1','F1','G1','H1'].forEach(ref => {
    if (summaryWs[ref]) summaryWs[ref].s = bold;
  });

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const date = todayStamp();
  XLSX.writeFile(wb, `Intune-RBAC-Roles-${date}.xlsx`);
}
