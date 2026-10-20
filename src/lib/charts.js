/* IMDb Top listeleri.
   • Öncelik: repoya paketlenmiş statik liste (src/data/top-*.json)
     → ziyaretçiye anında açılır, CDN/hız limiti sorunları olmaz.
   • Paket yoksa: r.jina.ai okuyucusuyla canlı derleme
     (IMDb arama sayfaları; afiş ve tt-id markdown içinde gelir). */
import topFilmJson from '../data/top-film.json';
import topDiziJson from '../data/top-dizi.json';
import topAnimeJson from '../data/top-anime.json';

const BUNDLED = { film: topFilmJson, dizi: topDiziJson, anime: topAnimeJson };

const CACHE_PREFIX = 'fk_chart_v3_';
const TTL = 24 * 60 * 60 * 1000;

const FILM_GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];

const SERIES_GENRES = [
  'Action', 'Animation', 'Comedy', 'Crime', 'Drama', 'Fantasy',
  'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
];

function genreUrl(kind, genre, perPage) {
  /* tür sayfaları popülerlik sırasıyla gelir: genel topla (rating) tam
     örtüşmeyip katkı sağlar; null = genel rating topu */
  const params = new URLSearchParams({
    title_type: kind === 'dizi' ? 'tv_series,tv_miniseries' : 'feature',
    ...(genre ? { genres: genre.toLowerCase() } : {}),
    num_votes: kind === 'dizi' ? '25000,' : '50000,',
    sort: genre ? 'moviemeter,desc' : 'user_rating,desc',
    count: String(perPage),
    view: kind === 'dizi' ? 'simple' : 'advanced',
  });
  return `https://www.imdb.com/search/title/?${params.toString()}`;
}

/* reader küçük afiş (90px) verir; büyük boy parametresine çevir */
function hiRes(u) {
  if (!u) return null;
  return `${u.split('._V1_')[0]}._V1_QL75_UX450_.jpg`;
}

/* --- reader markdown'ını ayrıştır --- */
/* bir madde şu kalıptadır:
   *   ![Image 3: Christian Bale in The Dark Knight (2008)](https://m.media-amazon.com/...jpg)

   [](https://www.imdb.com/title/tt0468569/) Açıklama...
*/
function parseMarkdown(md, kind) {
  const items = [];
  const chunks = md.split(/(?:^|\n)\*   !\[Image /).slice(1);

  for (const chunk of chunks) {
    const ttMatch = chunk.match(/imdb\.com\/title\/(tt\d+)/);
    if (!ttMatch) continue;

    // alt format 1: "3: Christian Bale in The Dark Knight (2008)"
    let m = chunk.match(/^([0-9]+): .*? in (.*?),? \((\d{4})(?:[–—\-][^\)]*)?\)/);
    // alt format 2 (afişli, oyuncusuz): "5: Schindler's List (1993)"
    if (!m) m = chunk.match(/^([0-9]+): (.*?),? \((\d{4})(?:[–—\-][^\)]*)?\)/);
    if (!m) continue;

    const title = m[2]?.replace(/,$/, '').trim();
    const year = Number(m[3]);
    if (!title) continue;

    const imgMatch = chunk.match(/https:\/\/m\.media-amazon\.com[^)\s]+/);
    items.push({
      id: ttMatch[1],
      title,
      year,
      type: kind,
      image: hiRes(imgMatch?.[0]),
    });
  }
  return items;
}

function readCache(kind) {
  try {
    const pack = JSON.parse(localStorage.getItem(CACHE_PREFIX + kind));
    if (!pack?.items || Date.now() - pack.ts > TTL) return null;
    return pack.items;
  } catch {
    return null;
  }
}

function writeCache(kind, items) {
  try {
    localStorage.setItem(CACHE_PREFIX + kind, JSON.stringify({ ts: Date.now(), items }));
  } catch {
    /* kota doluysa sessizce geç */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* tek reader çağrısı; başarısızlıkta 1 kez yeniden dener (403 = hız limiti) */
async function fetchOne(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(`https://r.jina.ai/${url}`);
    if (res.status === 403) {
      // hız limiti — biraz bekleyip yeniden dene
      await sleep(2500);
      continue;
    }
    if (!res.ok) throw new Error(`reader ${res.status}`);
    const md = await res.text();
    return md;
  }
  throw new Error('reader hız limiti');
}

/* tür sorgularını sırayla (reader hız limitine saygılı) çek ve birleştir */
async function buildList(kind, onProgress) {
  const genres = kind === 'dizi' ? SERIES_GENRES : FILM_GENRES;
  const perPage = 50;
  const queries = [null, ...genres]; // null = türsüz genel top

  const all = [];
  const seen = new Set();

  for (let i = 0; i < queries.length; i += 1) {
    const url = genreUrl(kind, queries[i], perPage);
    const md = await fetchOne(url);
    const items = parseMarkdown(md, kind);
    let added = 0;
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(it);
      added += 1;
    }
    onProgress?.({ done: i + 1, total: queries.length });

    /* reader hız limiti ~20/dk → her çağrı arasında nefes */
    if (i < queries.length - 1) await sleep(1600);
  }

  if (all.length === 0) throw new Error('liste boş');
  return all;
}

/* liste getir. Sıra: önbellek → paketlenmiş statik → canlı derleme.
   onProgress: {done, total} */
export async function fetchChart(kind, onProgress) {
  const cached = readCache(kind);
  if (cached) return cached;

  const bundled = BUNDLED[kind];
  if (Array.isArray(bundled) && bundled.length > 50) {
    writeCache(kind, bundled);
    onProgress?.({ done: 1, total: 1 });
    return bundled;
  }

  const items = await buildList(kind, onProgress);
  writeCache(kind, items);
  return items;
}
