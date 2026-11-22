// تجميع الأعمال + التصدير (Excel / PDF / طباعة)
const TA_OWNER = (window.APP_CONFIG && APP_CONFIG.OWNER) || 'محمود عادل';

function taGroupWorks(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = (r.work_name || '').trim();
    if (!map.has(k)) map.set(k, { name: k, rows: [] });
    map.get(k).rows.push(r);
  }
  const works = [...map.values()];
  works.forEach(w => {
    w.rows.sort((a, b) => (a.tape_no ?? 0) - (b.tape_no ?? 0) || a.tape_id - b.tape_id);
    const f = w.rows[0];
    const pick = k => { for (const r of w.rows) { const x = r[k]; if (x && !['-', 'غير معلوم', 'بدون'].includes(String(x).trim())) return String(x).trim(); } return ''; };
    w.type = f.work_type; w.category = pick('category'); w.director = pick('director'); w.author = pick('author');
    w.cast = pick('cast_names'); w.scripts = pick('scripts'); w.singers = pick('singers');
    w.states = {};
    w.rows.forEach(r => { const s = r.state || 'غير محدد'; w.states[s] = (w.states[s] || 0) + 1; });
  });
  works.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return works;
}

// أعمدة جدول بيان الحالة (اسم العمل يُكتب مرة واحدة في رأس الكتلة)
const TA_REPORT_COLS = [
  ['tape_no','رقم الشريط'], ['tape_id','معرّف الشريط'], ['tape_kind','نوع الشريط'],
  ['episode','الحلقات'], ['part','الجزء'], ['color','اللون'], ['translation','الترجمة'],
  ['state','الحالة'], ['notes','ملاحظات'],
];
const taV = x => (x === null || x === undefined || x === '') ? '' : x;

function taToday() {
  return new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}
function taStamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function taDownloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// بديل بدون مكتبة: جدول HTML بامتداد xls (يفتح في Excel بدعم العربية)
function taHtmlXls(aoa, merges, name) {
  const skip = new Set();
  (merges || []).forEach(m => { for (let r = m.s.r + 1; r <= m.e.r; r++) skip.add(r + ':' + m.s.c); });
  const span = {}; (merges || []).forEach(m => span[m.s.r + ':' + m.s.c] = m.e.r - m.s.r + 1);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let h = '<html dir="rtl"><head><meta charset="utf-8"></head><body><table border="1">';
  aoa.forEach((row, r) => {
    h += '<tr>' + row.map((c, ci) => skip.has(r + ':' + ci) ? '' : `<td${span[r + ':' + ci] ? ` rowspan="${span[r + ':' + ci]}"` : ''}>${esc(c)}</td>`).join('') + '</tr>';
  });
  taDownloadBlob(new Blob(['﻿' + h + '</table></body></html>'], { type: 'application/vnd.ms-excel' }), name.replace(/\.xlsx$/, '.xls'));
}

function taSaveSheet(aoa, merges, widths, sheetName, fileName) {
  if (!window.XLSX) return taHtmlXls(aoa, merges, fileName);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (merges && merges.length) ws['!merges'] = merges;
  ws['!cols'] = widths.map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

// تصدير كل الحقول (للجدول الكامل / نتائج البحث)
function taExportRowsXLSX(rows) {
  const aoa = [FIELDS.map(f => f[2])];
  rows.forEach(r => aoa.push(FIELDS.map(f => f[3] === 'bool' ? (r[f[0]] == null ? '' : r[f[0]] ? 'نعم' : 'لا') : taV(r[f[0]]))));
  taSaveSheet(aoa, [], FIELDS.map(f => Math.min(40, Math.max(10, f[2].length + 4))), 'الأشرطة', `tapes_${taStamp()}.xlsx`);
}

// تصدير بيان الحالة: اسم العمل مرة واحدة (خلايا مدموجة رأسياً)
function taExportReportXLSX(works) {
  const head = ['اسم العمل', 'نوع العمل', 'إخراج', 'تأليف', 'سيناريو', 'الأبطال والضيوف / المطربون', ...TA_REPORT_COLS.map(c => c[1])];
  const aoa = [head], merges = [];
  works.forEach(w => {
    const start = aoa.length;
    const casts = [w.cast, w.singers && !w.cast ? w.singers : ''].filter(Boolean).join(' | ');
    w.rows.forEach((r, i) => aoa.push([i === 0 ? w.name : '', i === 0 ? taV(w.type) : '', i === 0 ? taV(w.director) : '', i === 0 ? taV(w.author) : '', i === 0 ? taV(w.scripts) : '', i === 0 ? casts : '', ...TA_REPORT_COLS.map(c => taV(r[c[0]]))]));
    if (w.rows.length > 1) [0, 1, 2, 3, 4, 5].forEach(c => merges.push({ s: { r: start, c }, e: { r: aoa.length - 1, c } }));
  });
  taSaveSheet(aoa, merges, [34, 16, 18, 18, 18, 50, 10, 12, 12, 9, 9, 11, 16, 16, 40], 'بيان الحالة', `status_report_${taStamp()}.xlsx`);
}

// ---------- الاتجاه + الطباعة + PDF ----------
function taSetOrientation(o) {
  document.getElementById('pageStyle').textContent =
    `@page{size:A4 ${o};margin:12mm 10mm 20mm}`;
}

function taStampCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.direction = 'rtl'; x.textAlign = 'center'; draw(x, w, h);
  return c.toDataURL('image/png');
}

async function taDownloadPDF(el, orient, fileName) {
  if (!window.html2pdf) throw new Error('lib');
  const land = orient === 'landscape';
  const W = land ? 297 : 210, H = land ? 210 : 297;
  const worker = html2pdf().set({
    margin: [10, 8, 14, 8], filename: fileName,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orient },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.work-head', '.sum-card'] },
  }).from(el).toPdf();
  await worker.get('pdf').then(pdf => {
    const n = pdf.internal.getNumberOfPages();
    const wm = taStampCanvas(900, 300, (x, w, h) => {
      x.translate(w / 2, h / 2); x.rotate(-0.35); x.fillStyle = 'rgba(15,61,94,0.07)';
      x.font = '800 90px Cairo, Tahoma, sans-serif'; x.fillText(`تصميم ${TA_OWNER}`, 0, 25);
    });
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      pdf.addImage(wm, 'PNG', (W - 150) / 2, (H - 50) / 2, 150, 50);
      const ft = taStampCanvas(1600, 60, (x, w, h) => {
        x.fillStyle = '#5b6b7a'; x.font = '600 28px Cairo, Tahoma, sans-serif';
        x.textAlign = 'right'; x.fillText(`تصميم ${TA_OWNER}`, w - 10, 40);
        x.textAlign = 'left'; x.fillText(`صفحة ${i} من ${n}`, 10, 40);
      });
      pdf.addImage(ft, 'PNG', 8, H - 11, W - 16, (W - 16) * 60 / 1600);
    }
  });
  await worker.save();
}
