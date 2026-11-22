// طبقة البيانات: Supabase فعلي، أو وضع تجريبي محلي عند عدم ضبط config.js
const DB = (() => {
  const cfg = window.APP_CONFIG || {};
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  let sb = null;

  // ---------- الوضع التجريبي ----------
  const DEMO_USERS = {
    'admin@demo.com':  { pw:'admin123',  profile:{ id:'d1', email:'admin@demo.com',  full_name:'مدير النظام',  role:'admin',  active:true } },
    'editor@demo.com': { pw:'editor123', profile:{ id:'d2', email:'editor@demo.com', full_name:'محرر',        role:'editor', active:true } },
    'viewer@demo.com': { pw:'viewer123', profile:{ id:'d3', email:'viewer@demo.com', full_name:'مشاهد',       role:'viewer', active:true } },
  };
  let demoRows = null;
  const demoProfiles = () => Object.values(DEMO_USERS).map(u => u.profile);

  async function init() {
    if (demo) return;
    if (!window.supabase) throw new Error('تعذّر تحميل مكتبة Supabase (تحقق من الاتصال بالإنترنت).');
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  async function signIn(email, password) {
    if (demo) {
      const u = DEMO_USERS[email.trim().toLowerCase()];
      if (!u || u.pw !== password) throw new Error('بيانات الدخول غير صحيحة');
      try { sessionStorage.setItem('demoUser', email.trim().toLowerCase()); } catch (e) {}
      return u.profile;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('بيانات الدخول غير صحيحة');
    return getProfile(data.user);
  }

  async function restore() {
    if (demo) {
      let e = null; try { e = sessionStorage.getItem('demoUser'); } catch (x) {}
      return e && DEMO_USERS[e] ? DEMO_USERS[e].profile : null;
    }
    const { data } = await sb.auth.getSession();
    return data.session ? getProfile(data.session.user) : null;
  }

  async function getProfile(user) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error || !data) throw new Error('لا يوجد ملف صلاحيات لهذا الحساب، تواصل مع المدير.');
    return data;
  }

  async function signOut() {
    if (demo) { try { sessionStorage.removeItem('demoUser'); } catch (e) {} return; }
    await sb.auth.signOut();
  }

  // ---------- الأشرطة ----------
  async function listTapes(onProgress) {
    if (demo) {
      if (!demoRows) demoRows = await (await fetch('data/demo-data.json')).json();
      return demoRows;
    }
    const PAGE = 1000;
    const first = await sb.from('tapes').select('*', { count: 'exact' }).order('tape_id').range(0, PAGE - 1);
    if (first.error) throw new Error(first.error.message);
    const total = first.count || first.data.length;
    let rows = first.data;
    onProgress && onProgress(rows.length, total);
    const jobs = [];
    for (let from = PAGE; from < total; from += PAGE) {
      jobs.push(sb.from('tapes').select('*').order('tape_id').range(from, from + PAGE - 1));
    }
    const parts = await Promise.all(jobs);
    for (const p of parts) {
      if (p.error) throw new Error(p.error.message);
      rows = rows.concat(p.data);
    }
    onProgress && onProgress(rows.length, total);
    return rows;
  }

  async function saveTape(row) {
    if (demo) {
      const i = demoRows.findIndex(r => r.tape_id === row.tape_id);
      if (i >= 0) demoRows[i] = row; else demoRows.push(row);
      return row;
    }
    const { data, error } = await sb.from('tapes').upsert(row, { onConflict: 'tape_id' }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function deleteTape(id) {
    if (demo) { demoRows = demoRows.filter(r => r.tape_id !== id); return; }
    const { error } = await sb.from('tapes').delete().eq('tape_id', id);
    if (error) throw new Error(error.message);
  }

  async function importRows(rows, onProgress) {
    const B = 500;
    for (let i = 0; i < rows.length; i += B) {
      const batch = rows.slice(i, i + B);
      if (demo) {
        batch.forEach(r => { const k = demoRows.findIndex(x => x.tape_id === r.tape_id); if (k >= 0) demoRows[k] = r; else demoRows.push(r); });
      } else {
        const { error } = await sb.from('tapes').upsert(batch, { onConflict: 'tape_id' });
        if (error) throw new Error(error.message);
      }
      onProgress && onProgress(Math.min(i + B, rows.length), rows.length);
    }
  }

  // ---------- المستخدمون ----------
  async function listProfiles() {
    if (demo) return demoProfiles();
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    if (error) throw new Error(error.message);
    return data;
  }
  async function updateProfile(id, patch) {
    if (demo) { const u = Object.values(DEMO_USERS).find(x => x.profile.id === id); Object.assign(u.profile, patch); return; }
    const { error } = await sb.from('profiles').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  return { demo, init, signIn, restore, signOut, listTapes, saveTape, deleteTape, importRows, listProfiles, updateProfile };
})();
