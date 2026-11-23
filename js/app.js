/* أرشيف الأشرطة – الواجهة الرئيسية */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const uniq = k => [...new Set(S.tapes.map(r => r[k]).filter(x => x !== null && x !== undefined && x !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'ar'));

const S = {
  profile: null, logo: null, tapes: [], page: 'dashboard',
  tf: { q: '', type: '', state: '', color: '', kind: '', page: 1 },
  rf: { color: '', signer: (() => { try { return localStorage.getItem('signer') || ''; } catch (e) { return ''; } })(), title: 'رئيس الإدارة المركزية للمكتبات والأفلام', kind: 'status', q: '', type: '', state: '', category: '', work: '', orient: 'portrait', limit: 40 },
};
const PAGE_SIZE = 50;
const ROLE_AR = { admin: 'مدير', editor: 'محرر', viewer: 'مشاهد' };
const can = a => ({ edit: ['admin', 'editor'], delete: ['admin'], admin: ['admin'] }[a] || []).includes(S.profile?.role);
const SEARCH = new WeakMap();
const searchText = r => {
  let t = SEARCH.get(r);
  if (t === undefined) {
    t = norm([r.work_name, r.director, r.cast_names, r.author, r.singers, r.category, r.notes, r.tape_id, r.tape_no, r.doc_id].join(' | '));
    SEARCH.set(r, t);
  }
  return t;
};
const stateChip = s => `<span class="chip ${STATE_CLASS[s] || 'muted'}">${esc(s || 'غير محدد')}</span>`;

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500);
}

// ================= الإقلاع والدخول =================
async function boot() {
  $('#yr').textContent = new Date().getFullYear();
  try { await DB.init(); } catch (e) { return showLogin(e.message); }
  if (DB.demo) {
    $('#demoNote').hidden = false;
    $('#demoNote').innerHTML = 'وضع تجريبي (Supabase غير مضبوط). حسابات التجربة:<br><code>admin@demo.com / admin123</code><br><code>editor@demo.com / editor123</code><br><code>viewer@demo.com / viewer123</code>';
    $('#modeBadge').hidden = false;
  }
  try {
    const p = await DB.restore();
    if (p) return enter(p);
  } catch (e) { /* تجاهل */ }
  showLogin();
}
function showLogin(msg) {
  $('#appView').hidden = true; $('#loginView').hidden = false;
  $('#loginErr').textContent = msg || '';
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; $('#loginErr').textContent = '';
  try { enter(await DB.signIn($('#loginEmail').value, $('#loginPass').value)); }
  catch (err) { $('#loginErr').textContent = err.message; }
  btn.disabled = false;
});
$('#logoutBtn').addEventListener('click', async () => { await DB.signOut(); S.profile = null; S.tapes = []; history.replaceState(null, '', location.pathname); showLogin(); });

async function enter(profile) {
  if (!profile.active) {
    await DB.signOut(); return showLogin('حسابك بانتظار التفعيل من المدير.');
  }
  S.profile = profile;
  $('#loginView').hidden = true; $('#appView').hidden = false;
  $('#userName').textContent = profile.full_name || profile.email;
  $('#userRole').textContent = ROLE_AR[profile.role];
  const items = [['dashboard', 'الرئيسية'], ['tapes', 'الأشرطة'], ['works', 'الأعمال'], ['report', 'التقارير']];
  if (can('admin')) items.push(['import', 'استيراد'], ['users', 'المستخدمون'], ['settings', 'الإعدادات']);
  $('#nav').innerHTML = items.map(([k, l]) => `<a href="#/${k}" data-p="${k}">${l}</a>`).join('');
  $('#view').innerHTML = '<div class="loading"><div class="spin"></div><p id="loadMsg">جارٍ تحميل البيانات…</p></div>';
  try {
    S.tapes = await DB.listTapes((a, b) => { const m = $('#loadMsg'); if (m) m.textContent = `جارٍ تحميل البيانات… ${a} / ${b}`; });
  } catch (e) { $('#view').innerHTML = `<div class="empty err">تعذّر تحميل البيانات: ${esc(e.message)}</div>`; return; }
  try { S.logo = await DB.getSetting('logo'); } catch (e) { S.logo = null; }
  S.logo = S.logo || window.DEFAULT_LOGO || 'img/logo.png';
  if (!S.tapes.length) toast('لا توجد بيانات في جدول الأشرطة بعد — استورد الشيت أولاً.', true);
  route();
}
window.addEventListener('hashchange', () => S.profile && route());

function go(p) { location.hash = '#/' + p; }
function route() {
  const p = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const allowed = ['dashboard', 'tapes', 'works', 'report', 'import', 'users', 'settings'];
  S.page = allowed.includes(p) ? p : 'dashboard';
  if (['import', 'users', 'settings'].includes(S.page) && !can('admin')) S.page = 'dashboard';
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === S.page));
  document.title = 'أرشيف الأشرطة – ' + ({ dashboard: 'الرئيسية', tapes: 'الأشرطة', works: 'الأعمال', report: 'التقارير', import: 'استيراد', users: 'المستخدمون', settings: 'الإعدادات' }[S.page]);
  ({ dashboard: viewDashboard, tapes: viewTapes, works: viewWorks, report: viewReport, import: viewImport, users: viewUsers, settings: viewSettings }[S.page])();
  window.scrollTo(0, 0);
}

// ================= الرئيسية =================
function countBy(rows, k) {
  const m = {}; rows.forEach(r => { const x = r[k] || 'غير محدد'; m[x] = (m[x] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function bars(title, entries, key, limit) {
  const list = entries.slice(0, limit || 8), max = Math.max(1, ...list.map(e => e[1]));
  return `<section class="card"><h3>${title}</h3>${list.map(([n, c]) => `
    <button class="bar" data-act="filter" data-key="${key}" data-val="${esc(n)}">
      <span class="bl">${esc(n)}</span><span class="bt"><i style="width:${(c / max * 100).toFixed(1)}%"></i></span><span class="bn">${c.toLocaleString('ar-EG')}</span>
    </button>`).join('')}</section>`;
}
function viewDashboard() {
  const rows = S.tapes, works = new Set(rows.map(r => r.work_name)).size;
  const ok = rows.filter(r => r.state === 'مقبول').length, bad = rows.filter(r => /مرفوض|غير صالح/.test(r.state || '')).length;
  const unk = rows.filter(r => !r.state || r.state === 'غير معلوم').length;
  const kpi = (n, l, c) => `<div class="kpi ${c || ''}"><b>${n.toLocaleString('ar-EG')}</b><span>${l}</span></div>`;
  $('#view').innerHTML = `
    <div class="page-head"><h2>لوحة المعلومات</h2><span class="muted">مرحباً ${esc(S.profile.full_name || '')}</span></div>
    <div class="kpis">${kpi(rows.length, 'إجمالي الأشرطة')}${kpi(works, 'عدد الأعمال')}${kpi(ok, 'مقبول', 'ok')}${kpi(bad, 'مرفوض', 'bad')}${kpi(unk, 'حالة غير معلومة', 'muted')}</div>
    <div class="grid2">
      ${bars('الأشرطة حسب الحالة', countBy(rows, 'state'), 'state', 12)}
      ${bars('الأشرطة حسب نوع العمل', countBy(rows, 'work_type'), 'work_type', 12)}
      ${bars('أكثر التصنيفات', countBy(rows, 'category'), 'category', 10)}
      ${bars('اللون', countBy(rows, 'color'), 'color', 5)}
    </div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="filter"]'); if (!b) return;
  const key = b.dataset.key, val = b.dataset.val;
  S.tf = { q: '', type: '', state: '', color: '', kind: '', page: 1 };
  if (key === 'category') { S.rf = { ...S.rf, category: val, type: '', state: '', q: '', work: '', kind: 'status' }; return go('report'); }
  const map = { state: 'state', work_type: 'type', color: 'color' };
  S.tf[map[key]] = val; go('tapes');
});

// ================= الأشرطة =================
function filterTapes(f) {
  const q = norm(f.q).trim();
  return S.tapes.filter(r => (!f.type || r.work_type === f.type) && (!f.state || (r.state || 'غير محدد') === f.state) &&
    (!f.color || r.color === f.color) && (!f.kind || r.tape_kind === f.kind) && (!q || searchText(r).includes(q)));
}
const opts = (arr, sel) => `<option value="">الكل</option>` + arr.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

function viewTapes() {
  const f = S.tf;
  $('#view').innerHTML = `
    <div class="page-head"><h2>الأشرطة</h2>
      <div class="actions no-print">
        ${can('edit') ? '<button class="btn primary" data-act="new">+ إضافة شريط</button>' : ''}
        <button class="btn" id="tpReport">تقرير بيان حالة</button>
        <button class="btn" id="tpXlsx">تصدير Excel</button>
      </div></div>
    <div class="filters no-print">
      <input id="fq" type="search" placeholder="بحث: اسم العمل، مخرج، مؤلف، أبطال، رقم…" value="${esc(f.q)}">
      <label>نوع العمل<select id="ft">${opts(uniq('work_type'), f.type)}</select></label>
      <label>الحالة<select id="fs">${opts([...new Set(S.tapes.map(r => r.state || 'غير محدد'))].sort(), f.state)}</select></label>
      <label>اللون<select id="fc">${opts(uniq('color'), f.color)}</select></label>
      <label>نوع الشريط<select id="fk">${opts(uniq('tape_kind'), f.kind)}</select></label>
      <button class="btn primary" id="fgo">🔍 بحث</button>
      <button class="btn ghost" id="fclear">مسح</button>
    </div>
    <div id="tapesTable"></div>`;
  const upd = () => { f.q = $('#fq').value; f.type = $('#ft').value; f.state = $('#fs').value; f.color = $('#fc').value; f.kind = $('#fk').value; };
  let t; $('#fq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { upd(); f.page = 1; drawTapes(); }, 200); });
  ['ft', 'fs', 'fc', 'fk'].forEach(i => $('#' + i).addEventListener('change', () => { upd(); f.page = 1; drawTapes(); }));
  $('#fgo').onclick = () => { upd(); f.page = 1; drawTapes(); };
  $('#fq').addEventListener('keydown', e => { if (e.key === 'Enter') $('#fgo').click(); });
  $('#fclear').onclick = () => { S.tf = { q: '', type: '', state: '', color: '', kind: '', page: 1 }; viewTapes(); };
  $('#tpXlsx').onclick = () => taExportRowsXLSX(filterTapes(S.tf));
  $('#tpReport').onclick = () => { S.rf = { ...S.rf, kind: 'status', q: f.q, type: f.type, state: f.state, color: f.color, category: '', work: '' }; go('report'); };
  drawTapes();
}
function drawTapes() {
  try { drawTapesInner(); } catch (e) { $('#tapesTable').innerHTML = `<div class="empty err">خطأ في العرض: ${esc(e.message)}</div>`; console.error(e); }
}
function drawTapesInner() {
  const f = S.tf, rows = filterTapes(f), pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  f.page = Math.min(f.page, pages);
  const slice = rows.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE);
  $('#tapesTable').innerHTML = `
    <div class="count">${rows.length.toLocaleString('ar-EG')} شريط مطابق</div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th>اسم العمل</th><th>رقم الشريط</th><th>نوع العمل</th><th>نوع الشريط</th><th>الحلقات</th><th>اللون</th><th>الحالة</th><th class="no-print"></th></tr></thead>
      <tbody>${slice.map((r, i) => `<tr data-id="${r.tape_id}">
        <td class="num">${(f.page - 1) * PAGE_SIZE + i + 1}</td><td class="nm">${esc(r.work_name)}</td><td class="num">${esc(taV(r.tape_no))}</td>
        <td>${esc(taV(r.work_type))}</td><td>${esc(taV(r.tape_kind))}</td><td>${esc(taV(r.episode))}</td><td>${esc(taV(r.color))}</td><td>${stateChip(r.state)}</td>
        <td class="no-print rowact"><button class="lnk" data-act="view" data-id="${r.tape_id}">عرض</button>
        ${can('edit') ? `<button class="lnk" data-act="edit" data-id="${r.tape_id}">تعديل</button>` : ''}
        ${can('delete') ? `<button class="lnk danger" data-act="del" data-id="${r.tape_id}">حذف</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">لا توجد نتائج</td></tr>'}</tbody>
    </table></div>
    <div class="pager no-print">
      <button class="btn sm" data-pg="${f.page - 1}" ${f.page <= 1 ? 'disabled' : ''}>السابق</button>
      <span>صفحة ${f.page} من ${pages}</span>
      <button class="btn sm" data-pg="${f.page + 1}" ${f.page >= pages ? 'disabled' : ''}>التالي</button>
    </div>`;
}
document.addEventListener('click', e => {
  const pg = e.target.closest('[data-pg]');
  if (pg && S.page === 'tapes') { S.tf.page = +pg.dataset.pg; drawTapes(); window.scrollTo(0, 0); }
});

// ================= الأعمال =================
function viewWorks() {
  $('#view').innerHTML = `
    <div class="page-head"><h2>الأعمال</h2><span class="muted" id="wCount"></span></div>
    <div class="filters no-print"><input id="wq" type="search" placeholder="ابحث باسم العمل أو المخرج…"><button class="btn primary" id="wgo">🔍 بحث</button></div>
    <div id="worksList"></div>`;
  const all = taGroupWorks(S.tapes);
  const draw = () => {
    const q = norm($('#wq').value).trim();
    const list = all.filter(w => !q || norm(w.name + ' ' + (w.director || '')).includes(q));
    $('#wCount').textContent = `${list.length.toLocaleString('ar-EG')} عمل`;
    $('#worksList').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>اسم العمل</th><th>النوع</th><th>التصنيف</th><th>إخراج</th><th>الأشرطة</th><th>الحالات</th><th class="no-print"></th></tr></thead><tbody>` +
      list.slice(0, 200).map(w => `<tr><td class="nm">${esc(w.name)}</td><td>${esc(taV(w.type))}</td><td>${esc(taV(w.category))}</td><td>${esc(taV(w.director))}</td>
        <td class="num">${w.rows.length}</td><td>${Object.entries(w.states).map(([s, c]) => `${stateChip(s)}<small>×${c}</small>`).join(' ')}</td>
        <td class="no-print"><button class="lnk" data-act="wreport" data-w="${esc(w.name)}">بيان حالة</button></td></tr>`).join('') +
      `</tbody></table></div>${list.length > 200 ? `<p class="muted center">يُعرض أول 200 عمل — استخدم البحث لتضييق النتائج.</p>` : ''}`;
  };
  $('#wq').addEventListener('input', draw); $('#wgo').onclick = draw; draw();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="wreport"]'); if (!b) return;
  S.rf = { ...S.rf, kind: 'status', work: b.dataset.w, q: '', type: '', state: '', category: '' }; go('report');
});

// ================= التقارير =================
function reportRows() {
  const r = S.rf, q = norm(r.q).trim();
  return S.tapes.filter(x => (!r.work || x.work_name.trim() === r.work) && (!r.type || x.work_type === r.type) &&
    (!r.state || (x.state || 'غير محدد') === r.state) && (!r.category || x.category === r.category) && (!r.color || x.color === r.color) && (!q || searchText(x).includes(q)));
}
function filterSummary() {
  const r = S.rf, p = [];
  if (r.work) p.push('العمل: ' + r.work); if (r.type) p.push('النوع: ' + r.type); if (r.state) p.push('الحالة: ' + r.state);
  if (r.category) p.push('التصنيف: ' + r.category); if (r.color) p.push('اللون: ' + r.color); if (r.q) p.push('بحث: ' + r.q);
  return p.length ? p.join(' | ') : 'جميع الأعمال';
}
function viewReport() {
  const r = S.rf;
  $('#view').innerHTML = `
    <div class="page-head no-print"><h2>التقارير</h2></div>
    <div class="rep-controls no-print">
      <div class="filters">
        <label>نوع التقرير<select id="rk"><option value="status" ${r.kind === 'status' ? 'selected' : ''}>بيان حالة لكل عمل</option><option value="names" ${r.kind === 'names' ? 'selected' : ''}>قائمة أسماء الأعمال (3 أعمدة)</option><option value="summary" ${r.kind === 'summary' ? 'selected' : ''}>ملخص إحصائي (نوع العمل × الحالة)</option></select></label>
        <input id="rq" type="search" placeholder="بحث…" value="${esc(r.q)}">
        <label>نوع العمل<select id="rt">${opts(uniq('work_type'), r.type)}</select></label>
        <label>الحالة<select id="rs">${opts([...new Set(S.tapes.map(x => x.state || 'غير محدد'))].sort(), r.state)}</select></label>
        <label>التصنيف<select id="rc">${opts(uniq('category'), r.category)}</select></label>
        <label>اللون<select id="rcol">${opts(uniq('color'), r.color)}</select></label>
        <label>اسم الموقّع<input id="rsign" placeholder="اسم رئيس الإدارة" value="${esc(r.signer)}"></label>
        <button class="btn primary" id="rgo">🔍 عرض</button>
        <button class="btn ghost" id="rclear">مسح</button>
      </div>
      ${r.work ? `<div class="work-chip">العمل: <b>${esc(r.work)}</b> <button class="lnk" id="rwork">✕ إلغاء</button></div>` : ''}
      <div class="out-bar">
        <div class="seg" role="radiogroup" aria-label="اتجاه الصفحة">
          <label><input type="radio" name="ori" value="portrait" ${r.orient === 'portrait' ? 'checked' : ''}> <span>طولي (Portrait)</span></label>
          <label><input type="radio" name="ori" value="landscape" ${r.orient === 'landscape' ? 'checked' : ''}> <span>عرضي (Landscape)</span></label>
        </div>
        <button class="btn primary" id="rPrint">🖨 طباعة</button>
        <button class="btn" id="rPdf">⬇ تصدير PDF</button>
        <button class="btn" id="rXlsx">⬇ تصدير Excel</button>
      </div>
    </div>
    <div class="paper-wrap"><div id="paper" class="paper ${r.orient}"></div></div>`;
  const upd = () => { r.kind = $('#rk').value; r.q = $('#rq').value; r.type = $('#rt').value; r.state = $('#rs').value; r.category = $('#rc').value; r.color = $('#rcol').value; r.limit = 40; };
  let t; $('#rq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { upd(); drawReport(); }, 250); });
  ['rk', 'rt', 'rs', 'rc', 'rcol'].forEach(i => $('#' + i).addEventListener('change', () => { upd(); drawReport(); }));
  $('#rsign').addEventListener('input', e => { r.signer = e.target.value; try { localStorage.setItem('signer', r.signer); } catch (x) {} $$('.sign-name').forEach(n => n.textContent = r.signer); });
  $('#rgo').onclick = () => { upd(); drawReport(); };
  $('#rclear').onclick = () => { S.rf = { ...r, q: '', type: '', state: '', category: '', color: '', work: '', limit: 40 }; viewReport(); };
  if (r.work) $('#rwork').onclick = () => { r.work = ''; viewReport(); };
  $$('input[name=ori]').forEach(x => x.addEventListener('change', () => { r.orient = x.value; $('#paper').className = 'paper ' + r.orient; taSetOrientation(r.orient); }));
  $('#rPrint').onclick = doPrint; $('#rPdf').onclick = doPdf;
  $('#rXlsx').onclick = () => r.kind === 'names' ? taExportNamesXLSX(taGroupWorks(reportRows())) : r.kind === 'summary' ? taExportRowsXLSX(reportRows()) : taExportReportXLSX(taGroupWorks(reportRows()));
  taSetOrientation(r.orient); drawReport();
}

function workBlock(w, i, intro) {
  const items = [['النوع', w.type], ['التصنيف', w.category], ['إخراج', w.director], ['تأليف', w.author], ['سيناريو', w.scripts], ['عدد الأشرطة', String(w.rows.length)]].filter(x => x[1]);
  let info = '';
  for (let k = 0; k < items.length; k += 2) {
    const a1 = items[k], b1 = items[k + 1];
    info += `<tr><th>${a1[0]}</th><td${b1 ? '' : ' colspan="3"'}>${esc(a1[1])}</td>${b1 ? `<th>${b1[0]}</th><td>${esc(b1[1])}</td>` : ''}</tr>`;
  }
  if (w.cast) info += `<tr><th>الأبطال والضيوف</th><td colspan="3">${esc(w.cast)}</td></tr>`;
  if (w.singers) info += `<tr><th>المطربون</th><td colspan="3">${esc(w.singers)}</td></tr>`;
  info += `<tr><th>الحالات</th><td colspan="3">${Object.entries(w.states).map(([s, c]) => `${stateChip(s)}<small>×${c}</small>`).join(' ')}</td></tr>`;
  return `<section class="work page">
    ${banner()}${intro || stripHTML()}
    <table class="info"><thead><tr><th class="ttl" colspan="4">${esc(w.name)}</th></tr></thead><tbody>${info}</tbody></table>
    <table class="rt"><thead><tr><th class="c-i">م</th>${TA_REPORT_COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
    <tbody>${w.rows.map((r, i) => `<tr><td class="c-i">${i + 1}</td>${TA_REPORT_COLS.map(([k]) => k === 'state' ? `<td>${stateChip(r.state)}</td>` : `<td${k === 'notes' ? ' class="c-n"' : ''}>${esc(taV(r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${signHTML()}</section>`;
}
function summaryHTML(rows) {
  const types = [...new Set(rows.map(r => r.work_type || 'غير محدد'))].sort((a, b) => a.localeCompare(b, 'ar'));
  const states = [...new Set(rows.map(r => r.state || 'غير محدد'))].sort((a, b) => a.localeCompare(b, 'ar'));
  const m = {}; rows.forEach(r => { const t = r.work_type || 'غير محدد', s = r.state || 'غير محدد'; (m[t] ??= {})[s] = (m[t][s] || 0) + 1; });
  const tot = s => rows.filter(r => (r.state || 'غير محدد') === s).length;
  return `<table class="rt sum"><thead><tr><th>نوع العمل</th>${states.map(s => `<th>${esc(s)}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>
    ${types.map(t => `<tr><td class="nm">${esc(t)}</td>${states.map(s => `<td class="num">${m[t][s] || '—'}</td>`).join('')}<td class="num"><b>${Object.values(m[t]).reduce((a, b) => a + b, 0)}</b></td></tr>`).join('')}
    <tr class="tot"><td>الإجمالي</td>${states.map(s => `<td class="num">${tot(s)}</td>`).join('')}<td class="num">${rows.length}</td></tr></tbody></table>`;
}
const signHTML = () => `<div class="sign"><div class="sign-title">${esc(S.rf.title)}</div><div class="sign-space"></div><div class="sign-name">${esc(S.rf.signer)}</div></div>`;
const banner = () => S.logo ? `<img class="logo-banner" src="${S.logo}" alt="" onerror="this.style.display='none'">` : '';
const repTitle = () => ({ summary: 'ملخص حالة الأشرطة', names: 'قائمة الأعمال' }[S.rf.kind] || 'بيان حالة الأعمال');
const stripHTML = () => `<div class="rep-strip"><b>${repTitle()}</b><span>${S.rf.kind === 'names' ? esc(filterSummary()) + ' — ' : ''}${taToday()}</span></div>`;
function introHTML(rows, works) {
  const sc = {}; rows.forEach(x => { const s = x.state || 'غير محدد'; sc[s] = (sc[s] || 0) + 1; });
  return `<div class="rep-head"><div><h2>${repTitle()}</h2><div class="sub">${esc(filterSummary())}</div></div>
      <div class="rmeta"><div>التاريخ: ${taToday()}</div><div>أعدّه: ${esc(S.profile.full_name || S.profile.email)}</div></div></div>
    <div class="sum-row"><div class="sum-card"><b>${works.length.toLocaleString('ar-EG')}</b><span>عمل</span></div><div class="sum-card"><b>${rows.length.toLocaleString('ar-EG')}</b><span>شريط</span></div>
      ${S.rf.kind === 'names' ? '' : Object.entries(sc).sort((a, b) => b[1] - a[1]).map(([s, c]) => `<div class="sum-card">${stateChip(s)}<b>${c.toLocaleString('ar-EG')}</b></div>`).join('')}</div>`;
}

function namesHTML(works, rows) {
  const land = S.rf.orient === 'landscape', first = land ? 7 : 20, rest = land ? 10 : 22;
  const pages = []; let i = 0;
  while (i < works.length) { const n = (pages.length ? rest : first) * 3; pages.push({ start: i, items: works.slice(i, i + n) }); i += n; }
  return pages.map((p, pi) => {
    const R = Math.ceil(p.items.length / 3); let tr = '';
    for (let r = 0; r < R; r++) {
      tr += '<tr>' + [0, 1, 2].map(c => { const k = c * R + r, w = p.items[k]; return w ? `<td class="n">${p.start + k + 1}</td><td class="t">${esc(w.name)}</td>` : '<td class="n"></td><td class="t"></td>'; }).join('') + '</tr>';
    }
    return `<section class="work page">${banner()}${pi === 0 ? introHTML(rows, works) : stripHTML()}<table class="names"><tbody>${tr}</tbody></table>${pi === pages.length - 1 ? signHTML() : ''}</section>`;
  }).join('');
}
function drawReport(all) {
  const r = S.rf, rows = reportRows(), el = $('#paper'); if (!el) return;
  const works = taGroupWorks(rows), shown = all ? works : works.slice(0, r.limit);
  el.className = 'paper ' + r.orient;
  let body;
  if (!rows.length) body = banner() + '<div class="empty">لا توجد بيانات مطابقة</div>';
  else if (r.kind === 'names') body = namesHTML(works, rows);
  else if (r.kind === 'summary') body = `<section class="work page">${banner()}${introHTML(rows, works)}${summaryHTML(rows)}${signHTML()}</section>`;
  else body = shown.map((w, i) => workBlock(w, i, i === 0 ? introHTML(rows, works) : '')).join('');
  el.innerHTML = `<table class="pwrap"><tbody><tr><td>
    ${body}
    ${!all && r.kind === 'status' && works.length > shown.length ? `<div class="more no-print"><button class="btn" id="rMore">عرض المزيد (${shown.length} من ${works.length})</button><span class="muted"> الطباعة والتصدير يشملان كل الأعمال.</span></div>` : ''}
    <div class="rep-end"> تصميم : محمود عادل— نهاية التقرير —</div>
    </td></tr></tbody><tfoot><tr><td class="sp-f"></td></tr></tfoot></table>`;
  const more = $('#rMore'); if (more) more.onclick = () => { r.limit += 60; drawReport(); };
}
function doPrint() {
  drawReport(true); taSetOrientation(S.rf.orient);
  const back = () => { drawReport(false); window.removeEventListener('afterprint', back); };
  window.addEventListener('afterprint', back);
  setTimeout(() => window.print(), 150);
}
async function doPdf() {
  const rows = reportRows();
  if (rows.length > 150) { toast('التقرير كبير: في نافذة الطباعة اختر "حفظ كـ PDF" لأفضل جودة وحجم.'); return doPrint(); }
  const btn = $('#rPdf'); btn.disabled = true; btn.textContent = 'جارٍ التجهيز…';
  try {
    drawReport(true);
    await taDownloadPDF($('#paper'), S.rf.orient, `report_${taStamp()}.pdf`);
  } catch (e) { toast('تعذّر إنشاء PDF مباشرة، استخدم الطباعة ← حفظ كـ PDF.', true); doPrint(); }
  drawReport(false); btn.disabled = false; btn.textContent = '⬇ تصدير PDF';
}

// ================= نوافذ (عرض / تعديل) =================
function modal(html, cls) {
  $('#modalRoot').innerHTML = `<div class="overlay"><div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  $('.overlay').addEventListener('mousedown', e => { if (e.target.classList.contains('overlay')) closeModal(); });
}
const closeModal = () => $('#modalRoot').innerHTML = '';
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function showTape(id) {
  const r = S.tapes.find(x => x.tape_id === id); if (!r) return;
  modal(`<div class="m-head"><h3>${esc(r.work_name)}</h3><button class="x" data-act="close">✕</button></div>
    <dl class="dl">${FIELDS.map(([k, , l, t]) => {
    let val = r[k]; if (val === null || val === undefined || val === '') return '';
    if (t === 'bool') val = val ? 'نعم' : 'لا';
    return `<div class="${/cast|story|notes|singers/.test(k) ? 'wide' : ''}"><dt>${l}</dt><dd>${k === 'state' ? stateChip(val) : esc(val)}</dd></div>`;
  }).join('')}</dl>`, 'big');
}
const LONG = new Set(['notes', 'cast_names', 'story', 'scripts', 'singers', 'source_song']);
const LISTS = { work_type: 'work_type', tape_kind: 'tape_kind', color: 'color', state: 'state', category: 'category', translation: 'translation' };
function editTape(id) {
  const isNew = id == null, r = isNew ? { tape_id: Math.max(0, ...S.tapes.map(x => x.tape_id)) + 1, taps: 1 } : { ...S.tapes.find(x => x.tape_id === id) };
  modal(`<form id="editForm"><div class="m-head"><h3>${isNew ? 'إضافة شريط' : 'تعديل: ' + esc(r.work_name)}</h3><button type="button" class="x" data-act="close">✕</button></div>
    <div class="form-grid">${FIELDS.map(([k, , l, t]) => {
    const val = r[k] ?? '', ro = k === 'tape_id' && !isNew ? 'readonly' : '', req = k === 'tape_id' || k === 'work_name' ? 'required' : '';
    let inp;
    if (t === 'bool') inp = `<select name="${k}"><option value="">—</option><option value="1" ${r[k] === true ? 'selected' : ''}>نعم</option><option value="0" ${r[k] === false ? 'selected' : ''}>لا</option></select>`;
    else if (LONG.has(k)) inp = `<textarea name="${k}" rows="2">${esc(val)}</textarea>`;
    else inp = `<input name="${k}" value="${esc(val)}" ${t === 'int' ? 'type="number"' : ''} ${LISTS[k] ? `list="dl_${k}"` : ''} ${ro} ${req}>`;
    return `<label class="${LONG.has(k) ? 'wide' : ''}">${l}${inp}</label>`;
  }).join('')}</div>
    ${Object.keys(LISTS).map(k => `<datalist id="dl_${k}">${uniq(k).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`).join('')}
    <div class="m-foot"><button class="btn primary" type="submit">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div></form>`, 'big');
  $('#editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const row = {};
    FIELDS.forEach(([k, , , t]) => {
      let x = e.target.elements[k].value.trim();
      row[k] = x === '' ? null : t === 'int' ? Number(x) : t === 'bool' ? x === '1' : x;
    });
    if (isNew && S.tapes.some(x => x.tape_id === row.tape_id)) return toast('معرّف الشريط مستخدم بالفعل', true);
    try {
      const saved = await DB.saveTape(row);
      const i = S.tapes.findIndex(x => x.tape_id === saved.tape_id);
      if (i >= 0) S.tapes[i] = saved; else S.tapes.push(saved);
      closeModal(); toast('تم الحفظ'); route();
    } catch (err) { toast('فشل الحفظ: ' + err.message, true); }
  });
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id ? +b.dataset.id : null;
  if (a === 'close') closeModal();
  else if (a === 'view') showTape(id);
  else if (a === 'new' && can('edit')) editTape(null);
  else if (a === 'edit' && can('edit')) editTape(id);
  else if (a === 'del' && can('delete')) {
    const r = S.tapes.find(x => x.tape_id === id);
    if (!confirm(`حذف الشريط ${r.tape_no} من «${r.work_name}»؟ لا يمكن التراجع.`)) return;
    try { await DB.deleteTape(id); S.tapes = S.tapes.filter(x => x.tape_id !== id); toast('تم الحذف'); route(); }
    catch (err) { toast('فشل الحذف: ' + err.message, true); }
  }
});
document.addEventListener('dblclick', e => { const tr = e.target.closest('#tapesTable tr[data-id]'); if (tr) showTape(+tr.dataset.id); });

// ================= الاستيراد (مدير) =================
function viewImport() {
  $('#view').innerHTML = `
    <div class="page-head"><h2>استيراد من Excel</h2></div>
    <section class="card narrow"><p>ارفع ملف الشيت بنفس أعمدته الأصلية (doc.ID، tape.ID، اسم العمل …). تتم الإضافة/التحديث حسب <b>tape.ID</b> دون حذف أي شيء.</p>
      <input type="file" id="impFile" accept=".xlsx,.xls,.csv">
      <div id="impInfo" class="muted"></div>
      <button class="btn primary" id="impGo" disabled>بدء الاستيراد</button>
      <progress id="impBar" value="0" max="100" hidden></progress></section>`;
  let parsed = [];
  $('#impFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!window.XLSX) return toast('مكتبة Excel لم تُحمَّل (تحقق من الإنترنت)', true);
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
    parsed = []; let skipped = 0;
    for (const o of raw) {
      const row = {};
      FIELDS.forEach(([k, h, , t]) => {
        let x = o[h]; if (typeof x === 'string') x = x.trim(); if (x === '' || x === undefined) x = null;
        if (x !== null) x = t === 'int' ? (isNaN(+x) ? null : Math.trunc(+x)) : t === 'bool' ? (x === true || x === 1 || x === '1' || /^(true|نعم)$/i.test(String(x))) : String(x);
        row[k] = x;
      });
      if (row.tape_id == null || !row.work_name) skipped++; else parsed.push(row);
    }
    $('#impInfo').textContent = `${parsed.length.toLocaleString('ar-EG')} صف جاهز، تم تخطي ${skipped} صف ناقص.`;
    $('#impGo').disabled = !parsed.length;
  });
  $('#impGo').onclick = async () => {
    if (!confirm(`استيراد ${parsed.length} صف؟`)) return;
    const bar = $('#impBar'); bar.hidden = false; $('#impGo').disabled = true;
    try {
      await DB.importRows(parsed, (a, b) => { bar.value = a / b * 100; });
      S.tapes = await DB.listTapes(); toast('تم الاستيراد بنجاح'); go('tapes');
    } catch (err) { toast('فشل الاستيراد: ' + err.message, true); $('#impGo').disabled = false; }
  };
}

// ================= المستخدمون (مدير) =================
async function viewUsers() {
  $('#view').innerHTML = '<div class="page-head"><h2>المستخدمون والصلاحيات</h2></div><div id="usersBox" class="loading"><div class="spin"></div></div>';
  try {
    const list = await DB.listProfiles();
    $('#usersBox').className = '';
    $('#usersBox').innerHTML = `<p class="muted">مدير: كل الصلاحيات • محرر: إضافة وتعديل الأشرطة • مشاهد: عرض وتصدير فقط.</p>
      <form id="newUser" class="filters" autocomplete="off">
        <label>الاسم<input name="name" required></label>
        <label>البريد الإلكتروني<input name="email" type="email" required dir="ltr"></label>
        <label>كلمة المرور (6 أحرف فأكثر)<input name="pw" type="text" minlength="6" required dir="ltr"></label>
        <label>الصلاحية<select name="role"><option value="viewer">مشاهد</option><option value="editor">محرر</option><option value="admin">مدير</option></select></label>
        <button class="btn primary" type="submit">+ إضافة مستخدم</button>
      </form>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>البريد</th><th>الصلاحية</th><th>مفعّل</th></tr></thead><tbody>
      ${list.map(u => `<tr><td>${esc(u.full_name)}</td><td dir="ltr" class="ltr">${esc(u.email)}</td>
        <td><select data-u="${u.id}" data-f="role" ${u.id === S.profile.id ? 'disabled' : ''}>${['admin', 'editor', 'viewer'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_AR[r]}</option>`).join('')}</select></td>
        <td><input type="checkbox" data-u="${u.id}" data-f="active" ${u.active ? 'checked' : ''} ${u.id === S.profile.id ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table></div>`;
    $('#newUser').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true;
      try {
        await DB.createUser(f.email.value, f.pw.value, f.name.value.trim(), f.role.value);
        toast('تمت إضافة المستخدم'); viewUsers();
      } catch (err) { toast('تعذّرت الإضافة: ' + err.message, true); b.disabled = false; }
    });
    $$('#usersBox [data-u]').forEach(el => el.addEventListener('change', async () => {
      const patch = { [el.dataset.f]: el.type === 'checkbox' ? el.checked : el.value };
      try { await DB.updateProfile(el.dataset.u, patch); toast('تم تحديث الصلاحية'); } catch (err) { toast('فشل التحديث: ' + err.message, true); }
    }));
  } catch (e) { $('#usersBox').innerHTML = `<div class="empty err">${esc(e.message)}</div>`; }
}

// ================= الإعدادات (مدير): لوجو التقرير =================
function viewSettings() {
  $('#view').innerHTML = `
    <div class="page-head"><h2>الإعدادات</h2></div>
    <section class="card narrow"><h3>لوجو التقارير</h3>
      <p class="muted">يظهر أعلى كل ورقة في التقرير بعرض الورقة بالكامل. الأفضل صورة عريضة (بانر) مثل 2000×300 بكسل بصيغة PNG أو JPG.</p>
      <div id="logoBox">${S.logo ? `<img class="logo-prev" src="${S.logo}" alt="اللوجو الحالي">` : '<div class="muted">لا يوجد لوجو حالياً.</div>'}</div>
      <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp">
      <div class="actions"><button class="btn primary" id="logoSave" disabled>حفظ اللوجو</button>${S.logo ? '<button class="btn" id="logoDel">حذف اللوجو</button>' : ''}</div>
    </section>`;
  let pending = null;
  $('#logoFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const W = Math.min(img.width, 1800), H = Math.round(img.height * W / img.width);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
      pending = f.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
      if (pending.length > 1500000) pending = cv.toDataURL('image/jpeg', 0.75);
      $('#logoBox').innerHTML = `<img class="logo-prev" src="${pending}" alt="معاينة">`; $('#logoSave').disabled = false;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast('تعذّر قراءة الصورة', true); img.src = url;
  });
  $('#logoSave').onclick = async () => {
    try { await DB.setSetting('logo', pending); S.logo = pending; toast('تم حفظ اللوجو'); viewSettings(); }
    catch (err) { toast('فشل الحفظ: ' + err.message + ' (هل شغّلت add_settings.sql؟)', true); }
  };
  const del = $('#logoDel');
  if (del) del.onclick = async () => { try { await DB.setSetting('logo', null); S.logo = null; toast('تم الحذف'); viewSettings(); } catch (err) { toast('فشل: ' + err.message, true); } };
}

boot();
