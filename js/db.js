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
    let url = String(cfg.SUPABASE_URL).trim().replace(/\s+/g, '');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { const u = new URL(url); url = u.origin; }
    catch (e) { throw new Error('رابط Supabase غير صحيح في js/config.js — الشكل المطلوب: https://xxxxxxxx.supabase.co'); }
    if (!/\.supabase\.(co|in)$/i.test(new URL(url).hostname) && !/localhost|127\.0\.0\.1/.test(url))
      throw new Error('SUPABASE_URL يجب أن ينتهي بـ .supabase.co (الحالي: ' + url + ')');
    sb = window.supabase.createClient(url, String(cfg.SUPABASE_ANON_KEY).trim());
  }

  function need() { if (!demo && !sb) throw new Error('لم يتم الاتصال بـ Supabase: تأكد من اتصال الإنترنت ثم حدّث الصفحة (Ctrl+F5).'); }

  async function signIn(email, password) {
    need();
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
    if (!demo && !sb) return null;
    if (demo) {
      let e = null; try { e = sessionStorage.getItem('demoUser'); } catch (x) {}
      return e && DEMO_USERS[e] ? DEMO_USERS[e].profile : null;
    }
    const { data } = await sb.auth.getSession();
    return data.session ? getProfile(data.session.user) : null;
  }

  async function getProfile(user) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw new Error('تعذّر قراءة الصلاحيات: ' + error.message);
    if (!data) throw new Error('لا يوجد ملف صلاحيات لهذا الحساب (معرّف الحساب: ' + user.id + ' — ' + (user.email || '') + ')، تواصل مع المدير.');
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

  async function createUser(email, password, fullName, role) {
    email = email.trim().toLowerCase();
    if (demo) {
      if (DEMO_USERS[email]) throw new Error('هذا البريد مسجل بالفعل');
      DEMO_USERS[email] = { pw: password, profile: { id: 'd' + Date.now(), email, full_name: fullName, role, active: true } };
      return;
    }
    need();
    // عميل منفصل حتى لا تتأثر جلسة المدير الحالية
    const tmp = window.supabase.createClient(sb.supabaseUrl, cfg.SUPABASE_ANON_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tmp-create-user' }
    });
    const { data, error } = await tmp.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) throw new Error(error.message);
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('هذا البريد مسجل بالفعل');
    const { error: e2 } = await sb.from('profiles').update({ role, active: true, full_name: fullName }).eq('id', data.user.id);
    if (e2) throw new Error('تم إنشاء الحساب لكن تعذّر ضبط الصلاحية: ' + e2.message);
  }

  // ---------- الإعدادات (اللوجو) ----------
  async function getSetting(key) {
    if (demo) { try { return localStorage.getItem('setting_' + key); } catch (e) { return null; } }
    const { data } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle();
    return data ? data.value : null;
  }
  async function setSetting(key, value) {
    if (demo) { try { value === null ? localStorage.removeItem('setting_' + key) : localStorage.setItem('setting_' + key, value); } catch (e) {} return; }
    const q = value === null ? sb.from('app_settings').delete().eq('key', key)
                             : sb.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    const { error } = await q;
    if (error) throw new Error(error.message);
  }

  return { demo, getSetting, setSetting, createUser, init, signIn, restore, signOut, listTapes, saveTape, deleteTape, importRows, listProfiles, updateProfile };
})();
