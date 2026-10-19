/* ============================================================
   Depo katmanı — iki mod:
   • bulut:  Supabase Auth + Postgres (VITE_SUPABASE_* doluysa)
              → kitaplık sunucuda saklanır, her cihazdan görünür
   • yerel:  localStorage demo modu (yapılandırma yoksa fallback)
   ============================================================ */

import { sb, cloudEnabled } from './supabase';

const USERS_KEY = 'fk_users_v1';
const SESSION_KEY = 'fk_session_v1';
const dataKey = (uid) => `fk_data_${uid}`;

export const isCloud = () => cloudEnabled() && !!sb();

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/* efsanevi djb2 hash'i — yalnızca yerel demo modu için */
function hashPassword(pw) {
  const s = `fk::${pw}`;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return `v1_${h.toString(16)}_${s.length.toString(16)}`;
}

/* ------------------- ad/şifre doğrulama (ortak) ------------------- */

function validate(name, password) {
  const username = name.trim();
  if (username.length < 2) return 'authErrorName';
  if (password.length < 6) return 'authErrorPass';
  return null;
}

/* ---------------------------- yerel mod ---------------------------- */

function localGetUsers() {
  return safeParse(localStorage.getItem(USERS_KEY), []);
}

function localFindUser(name) {
  const wanted = name.trim().toLowerCase();
  return localGetUsers().find((u) => u.username.toLowerCase() === wanted) || null;
}

function localRegister(name, password) {
  const vErr = validate(name, password);
  if (vErr) return { ok: false, error: vErr };
  const username = name.trim();
  if (localFindUser(username)) return { ok: false, error: 'authErrorExists' };

  const user = {
    id: `u_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e8).toString(36)}`,
    username,
    passHash: hashPassword(password),
    createdAt: Date.now(),
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([...localGetUsers(), user]));
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user };
}

function localLogin(name, password) {
  const user = localFindUser(name);
  if (!user) return { ok: false, error: 'authErrorNoUser' };
  if (user.passHash !== hashPassword(password)) return { ok: false, error: 'authErrorPassWrong' };
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user };
}

function localLoad(uid) {
  const data = safeParse(localStorage.getItem(dataKey(uid)), { movies: [] });
  if (!Array.isArray(data.movies)) data.movies = [];
  return data;
}

/* bulut moduna geçmeden önce bu cihazda kalmış eski kitaplıkları toplar */
export function collectLocalLibraries() {
  return localGetUsers().map((u) => ({
    username: u.username,
    movies: localLoad(u.id).movies,
  }));
}

/* ---------------------------- bulut mod ---------------------------- */

/* kullanıcı adı → sabit sözde e-posta (Supabase Auth e-posta ister;
   arkadaşlar yalnızca kullanıcı adı + şifre görür, e-posta sorulmaz) */
const pseudoEmail = (username) => {
  const n =
    username
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]/g, '') || 'uye';
  return `fk-${n}@kitaplik.app`;
};

function mapUser(u) {
  const username =
    u?.user_metadata?.username ??
    u?.email?.replace(/^fk-/, '').replace(/@.*/, '') ??
    'uye';
  return { id: u.id, username };
}

export async function register(name, password) {
  if (!isCloud()) return localRegister(name, password);

  const vErr = validate(name, password);
  if (vErr) return { ok: false, error: vErr };

  const username = name.trim();
  const { data, error } = await sb().auth.signUp({
    email: pseudoEmail(username),
    password,
    options: { data: { username } },
  });
  if (error) {
    if (/already|registered|taken/i.test(error.message)) return { ok: false, error: 'authErrorExists' };
    return { ok: false, error: 'authErrorUnknown' };
  }
  /* e-posta doğrulaması açıksa oturum null döner */
  if (!data.session) return { ok: false, error: 'authErrorConfirm' };
  return { ok: true, user: mapUser(data.user) };
}

export async function login(name, password) {
  if (!isCloud()) return localLogin(name, password);

  const { data, error } = await sb().auth.signInWithPassword({
    email: pseudoEmail(name),
    password,
  });
  if (error) {
    if (/email not confirmed/i.test(error.message)) return { ok: false, error: 'authErrorConfirm' };
    return { ok: false, error: 'authErrorInvalid' };
  }
  return { ok: true, user: mapUser(data.user) };
}

/* açılışta oturumu geri getirir */
export async function restoreUser() {
  if (!isCloud()) {
    const id = localStorage.getItem(SESSION_KEY);
    return localGetUsers().find((u) => u.id === id) || null;
  }
  const { data } = await sb().auth.getSession();
  return data?.session ? mapUser(data.session.user) : null;
}

export async function logout() {
  if (!isCloud()) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  await sb().auth.signOut();
}

/* --------------------------- kitaplık verisi --------------------------- */

const toRow = (userId, m) => ({
  id: m.id,
  user_id: userId,
  title: m.title,
  year: m.year ?? null,
  type: m.type ?? 'film',
  status: m.status ?? 'towatch',
  rating: m.rating ?? 0,
  note: m.note ?? '',
  image: m.image ?? null,
  added_at: m.addedAt ?? Date.now(),
  watched_at: m.watchedAt ?? null,
});

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  year: r.year,
  type: r.type,
  status: r.status,
  rating: r.rating ?? 0,
  note: r.note ?? '',
  image: r.image ?? null,
  addedAt: Number(r.added_at ?? 0),
  watchedAt: r.watched_at == null ? null : Number(r.watched_at),
});

export async function loadData(userId) {
  if (!isCloud()) return localLoad(userId);

  const { data, error } = await sb().from('movies').select('*').eq('user_id', userId);
  if (error) return { movies: [] };
  return { movies: (data ?? []).map(fromRow) };
}

export async function saveMovies(userId, movies) {
  if (!isCloud()) {
    localStorage.setItem(dataKey(userId), JSON.stringify({ movies }));
    return;
  }
  await sb().from('movies').upsert(movies.map((m) => toRow(userId, m)));
}
