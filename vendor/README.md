# Bundled libraries

These two libraries power the exports. They are checked in, rather than loaded from a CDN, so the
app works offline and the Windows build makes no network requests.

| File | Library | Version | License | Source |
|---|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.20.3 | Apache-2.0 (`xlsx.LICENSE.txt`) | `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` |
| `html2canvas.min.js` | html2canvas | 1.4.1 | MIT (`html2canvas.LICENSE.txt`) | npm package `html2canvas@1.4.1`, `dist/html2canvas.min.js` |

SHA-256:

```
cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41  xlsx.full.min.js
e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb  html2canvas.min.js
```

To update one, replace the file with the new release, update this table, and check that both exports still work.
