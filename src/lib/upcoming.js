/* Yakında — vizyon takvimi (film + dizi).
   • Dizi: TVMaze API (anahtarsız, CORS her yerde açık) — 14 günlük bölüm
     takvimi; "bilindik" filtresi: puan ≥ 7.3 + afiş + IMDb eşleşmesi +
     haber/talk/ev programları ayıklanır.
   • Film: IMDb coming-soon sayfası (r.jina.ai okuyucu) — 12 saat önbellek.

   Dönüş: [{ date: 'YYYY-MM-DD', items: [{id,title,year,type,image,extra}] }]
   — id'ler tt..., kitaplık modalı ve ekleme akışıyla birebir uyumlu. */

const CACHE_KEY = 'fk_upcoming_v1';
const FILM_TTL = 12 * 60 * 60 * 1000;
const BAD_GENRES = new Set(['News', 'Home', 'Talk']);
const MIN_RATING = 7.3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCache() {
  try {
    const p = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (p && Date.now() - p.ts < FILM_TTL) return p.films;
    return null;
  } catch {
    return null;
  }
}

function writeCache(films) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), films }));
  } catch {
    /* kota */
  }
}

/* --------------------------- film (IMDb) --------------------------- */

function hiRes(u) {
  if (!u) return null;
  return `${u.split('._V1_')[0]}._V1_QL75_UX450_.jpg`;
}

async function fetchComingSoonFilms() {
  const cached = readCache();
  if (cached) return cached;

  const res = await fetch('https://r.jina.ai/https://www.imdb.com/coming-soon/');
  if (!res.ok) throw new Error(`IMDb coming soon ${res.status}`);
  const md = await res.text();

  /* blokları tarih başlıklarına ayır */
  const blocks = md.split(/^#### /m).slice(1);
  const out = [];
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const head = block.slice(0, nl).trim(); // "Oct 23, 2026"
    const d = new Date(head);
    if (Number.isNaN(d.getTime())) continue;
    const date = d.toISOString().slice(0, 10);

    const items = [];
    const seen = new Set();
    /* her madde: afiş + [Title (year)](.../title/tt.../) kalıbı */
    const chunks = block.split(/\n\*   /).slice(1);
    for (const chunk of chunks) {
      const link = chunk.match(/\[([^\]]+?)\s*\((\d{4})\)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)/);
      if (!link) continue;
      const id = link[3];
      if (seen.has(id)) continue;
      seen.add(id);
      const title = link[1].trim();
      const img = chunk.match(/https:\/\/m\.media-amazon\.com[^)\s]+/);
      items.push({
        id,
        title,
        year: Number(link[2]),
        type: 'film',
        image: hiRes(img?.[0]),
      });
    }
    if (items.length) out.push({ date, items: items.slice(0, 10) });
  }
  writeCache(out);
  return out;
}

/* --------------------------- dizi (TVMaze) --------------------------- */

function isoPlus(days) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

async function fetchTVMazeSeries(days) {
  const groups = [];
  const seenShows = new Set();

  for (let i = 1; i <= days; i += 1) {
    const date = isoPlus(i);
    try {
      const res = await fetch(`https://api.tvmaze.com/schedule?country=US&date=${date}`);
      if (!res.ok) continue;
      const eps = await res.json();
      const perShow = new Set();
      const items = [];
      for (const e of eps ?? []) {
        const sh = e.show ?? {};
        const g = sh.genres ?? [];
        if ((sh.rating?.average ?? 0) < MIN_RATING) continue;
        if (!sh.image?.medium || !sh.externals?.imdb) continue;
        if (g.some((x) => BAD_GENRES.has(x))) continue;
        if (seenShows.has(sh.externals.imdb)) continue; // aynı dizi bir kez
        if (perShow.has(sh.externals.imdb)) continue;
        perShow.add(sh.externals.imdb);
        seenShows.add(sh.externals.imdb);
        const ep = `S${String(e.season ?? 0).padStart(2, '0')}E${String(e.number ?? 0).padStart(2, '0')}`;
        items.push({
          id: sh.externals.imdb,
          title: sh.name ?? 'Bilinmeyen',
          /* ilk yayın yılı gostermez: takvimdeki kartlar "dizi"
             etiketi + bölüm bilgisiyle oluş */
          year: null,
          type: 'dizi',
          image: sh.image.medium,
          extra: e.name && e.name !== 'Episode 205' ? `${ep} · ${e.name}` : ep,
        });
      }
      const trimmed = items.slice(0, 8);
      if (trimmed.length) groups.push({ date, items: trimmed });
    } catch {
      /* o gün atla */
    }
    await sleep(90); // TVMaze 20 istek/sn — güvenli tempo
  }
  return groups;
}

/* --------------------------- birleştir --------------------------- */

export async function fetchUpcoming(days = 14) {
  const [films, series] = await Promise.all([
    fetchComingSoonFilms().catch(() => []),
    fetchTVMazeSeries(days),
  ]);

  const byDate = new Map();
  const push = (date, item) => {
    if (!byDate.has(date)) byDate.set(date, { date, items: [] });
    byDate.get(date).items.push(item);
  };

  for (const g of films) {
    if (g.date >= isoPlus(0) && g.date <= isoPlus(days)) {
      for (const it of g.items) push(g.date, it);
    }
  }
  for (const g of series) for (const it of g.items) push(g.date, it);

  for (const g of byDate.values()) {
    /* tarih içinde: dizi önce, sonra film (alfabetik) */
    g.items.sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'dizi' ? -1 : 1));
    if (g.items.length > 12) g.items = g.items.slice(0, 12);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
