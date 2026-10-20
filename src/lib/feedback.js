/* Geri bildirim / mesaj kutusu.
   • Herkes (girişsiz ziyaretçi dahil) gönderebilir — hedef kullanıcı: OWNER
   • Sadece oturumlu kullanıcılar gelen mesajları okur (uygulama kutuyu
     yalnızca sahibi için gösterir).
   • Bulut yoksa (demo mod) localStorage'a düşer. */

import { sb, cloudEnabled } from './supabase';

export const OWNER = 'thyke'; // gelen mesajların sahibi (kullanıcı adı)

const LOCAL_KEY = 'fk_feedback_v1';

const localAll = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? [];
  } catch {
    return [];
  }
};

export async function sendFeedback(fromUsername, body) {
  const text = (body ?? '').trim();
  if (!text) return { ok: false };
  if (!cloudEnabled()) {
    const arr = localAll();
    arr.push({
      id: `l-${Date.now()}`,
      from_username: fromUsername || 'ziyaretci',
      body: text,
      created_at: new Date().toISOString(),
      read: false,
    });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
    return { ok: true };
  }
  const { error } = await sb()
    .from('feedback')
    .insert({ from_username: fromUsername || 'ziyaretci', body: text });
  return { ok: !error };
}

export async function listFeedback() {
  if (!cloudEnabled()) return localAll();
  const { data, error } = await sb()
    .from('feedback')
    .select('id, from_username, body, created_at, read')
    .order('created_at', { ascending: false })
    .limit(200);
  return error ? [] : data ?? [];
}

export async function markRead(ids) {
  if (!ids?.length) return;
  if (!cloudEnabled()) {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify(localAll().map((m) => (ids.includes(m.id) ? { ...m, read: true } : m))),
    );
    return;
  }
  await sb().from('feedback').update({ read: true }).in('id', ids);
}

export async function unreadCount() {
  const list = await listFeedback();
  return list.filter((m) => !m.read).length;
}
