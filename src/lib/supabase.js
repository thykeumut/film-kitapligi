/* Supabase istemcisi — .env'deki VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   değerleri doldurulduysa bulut modu, değilse uygulama yerel (demo) moda düşer. */
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const looksConfigured =
  /^https?:\/\/.+/.test(URL) &&
  KEY.length > 20 &&
  !/BURAYA/i.test(URL) &&
  !/BURAYA/i.test(KEY);

let client = null;

export function sb() {
  if (!looksConfigured) return null;
  if (!client) {
    try {
      client = createClient(URL, KEY);
    } catch {
      client = null;
    }
  }
  return client;
}

export const cloudEnabled = () => looksConfigured;
