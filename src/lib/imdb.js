/* IMDb veri katmanı — anahtarsız IMDb suggestion API + Wikipedia özeti.
   Sonuçlar localStorage'da önbelleklenir (offline + hızlı). */

const CACHE_KEY = 'fk_imdb_cache_v1';

/* ---------------------------- önbellek ---------------------------- */

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* kota dolsa da sessiz devam */
  }
}

/* ------------------------ IMDb suggestion -------------------------- */
/* https://v2.sg.media-imdb.com/suggestion/<ilk harf>/<sorgu>.json */

export function normalizeQuery(q) {
  return q
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // vurgu işaretlerini kaldır
    .replace(/\s+/g, ' ');
}

function suggestionUrl(q) {
  const n = normalizeQuery(q).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '_');
  const first = /^[a-z0-9]/.test(n) ? n[0] : '_';
  return `https://v2.sg.media-imdb.com/suggestion/${first}/${encodeURIComponent(n || 'search')}.json`;
}

function adopt(item) {
  return {
    id: item.id.replace(/\/$/, ''),
    title: item.l ?? 'Bilinmeyen',
    year: item.y ?? null,
    type: item.qid === 'tvSeries' ? 'dizi' : 'film',
    image: item.i?.imageUrl ?? null,
  };
}

async function fetchSuggestion(q) {
  const url = suggestionUrl(q);

  /* 1) doğrudan — sadece localhost türevi Origin'lerde CORS başlığı döner */
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return pickSuggestions(json);
    }
  } catch {
    /* CORS/Yasak → 2) jina okuyucu ile şeffaf proxy */
  }

  const res = await fetch(`https://r.jina.ai/${url}`);
  if (!res.ok) throw new Error(`IMDb sorgusu başarısız (${res.status})`);
  const txt = await res.text();
  const idx = txt.indexOf('Markdown Content:');
  const json = JSON.parse(txt.slice(txt.indexOf('{', idx)));
  return pickSuggestions(json);
}

function pickSuggestions(json) {
  return (json.d ?? [])
    .filter((it) => !it.id.startsWith('nm') && (it.i?.imageUrl || it.y))
    .map(adopt);
}

/* arama — önbellek anahtarına göre tekrarlı aramalarda isabet */
const searchMemory = new Map();

export async function searchImdb(q) {
  const nq = normalizeQuery(q);
  if (!nq) return [];
  if (searchMemory.has(nq)) return searchMemory.get(nq);

  const results = await fetchSuggestion(nq);
  // zenginleştirmek için önbilleğe at: tt-id başına detay
  const cache = loadCache();
  let dirty = false;
  for (const r of results) {
    if (r.id.startsWith('tt')) {
      const cur = cache[r.id];
      cache[r.id] = {
        ...(r ?? {}),
        ...(cur ?? {}),
        title: r.title,
      };
      dirty = true;
    }
  }
  if (dirty) saveCache(cache);

  searchMemory.set(nq, results);
  return results;
}

/* çoklu başlık (popüler vitrin) — paralel, tek tek sessiz hata */
export async function popularFromImdb(titles) {
  const settled = await Promise.allSettled(
    titles.map((t) => searchImdb(t).then((rs) => ({ q: t, rs }))),
  );
  return settled
    .filter((s) => s.status === 'fulfilled')
    .map((s) => s.value);
}

/* --------------------------- özet (wiki) --------------------------- */
/* lang'a göre domain zinciri: tr → önce tr.wikipedia, yoksa en.wikipedia */

export function imdbUrl(id) {
  return `https://www.imdb.com/title/${id}`;
}

function wikiSearchUrl(domain, sr) {
  return `https://${domain}/w/api.php?action=query&format=json&origin=*&list=search&srlimit=1&srsearch=${encodeURIComponent(sr)}`;
}

function wikiExtractUrl(domain, title) {
  return `https://${domain}/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;
}

async function tryWikiExtract(domain, sr) {
  const sres = await fetch(wikiSearchUrl(domain, sr));
  if (!sres.ok) throw new Error(`wiki search ${sres.status}`);
  const sj = await sres.json();
  const cand = sj?.query?.search?.[0]?.title;
  if (!cand) return null;

  const res = await fetch(wikiExtractUrl(domain, cand));
  if (!res.ok) throw new Error(`wiki extract ${res.status}`);
  const j = await res.json();
  const page = Object.values(j?.query?.pages ?? {})[0];
  const extract = page?.extract;
  if (!extract) return null;
  // İlk iki paragraf yeter
  return extract.split('\n').slice(0, 2).join('\n').trim();
}

/* dizi/film ipucu ile sorgu zenginleştirme
   — tr.wikipedia Türkçe sayfa adları kullanır: "dizi", "film" ekleri */
async function fetchWikiPlot(title, movie, lang) {
  const isSeries = movie?.type === 'dizi';

  const domains = lang === 'tr' ? ['tr.wikipedia.org', 'en.wikipedia.org'] : ['en.wikipedia.org', 'tr.wikipedia.org'];

  const queriesFor = (domain) => (domain.startsWith('tr')
    ? [`${title} (dizi)`, title, `${title} (film)`]
    : [
      isSeries ? `${title} (TV series)` : title,
      title,
    ]);

  let lastErr = null;
  for (const domain of domains) {
    for (const sr of queriesFor(domain)) {
      try {
        const plot = await tryWikiExtract(domain, sr);
        if (plot) return { plot, plotLang: domain.startsWith('tr') ? 'tr' : 'en' };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/* modal açılışta çağırılır; plot dil tercihi lang ile gelir ('tr' | 'en')
   — eski kayıtlardaki tek-dilli hit.plot, ilk açılışta plots.en'e taşınır */
export async function getDetails(movie, lang = 'tr') {
  const cache = loadCache();
  let hit = cache[movie.id];

  if (hit && !hit.plots && hit.plot) {
    hit = { ...hit, plots: { en: hit.plot } };
  }

  const plots = hit?.plots ?? null;
  if (plots?.[lang]) {
    const plot = plots[lang] ?? plots.tr ?? plots.en ?? null;
    const plotLang = plot === plots.tr ? 'tr' : 'en';
    return { ...hit, plot, plotLang };
  }

  /* IMDb id'li kayıtlar: doğrudan */
  if (movie.id?.startsWith('tt')) {
    const res = await fetchWikiPlot(movie.title, movie, lang).catch(() => null);

    const nextPlots = { ...(plots ?? {}) };
    if (res?.plot) nextPlots[res.plotLang] = res.plot;

    cache[movie.id] = {
      ...(hit ?? {}),
      title: movie.title,
      year: hit?.year ?? movie.year ?? null,
      type: hit?.type ?? movie.type ?? 'film',
      image: hit?.image ?? movie.image ?? null,
      plots: nextPlots,
      plotFetchedAt: Date.now(),
    };
    saveCache(cache);

    const plot = nextPlots[lang] ?? nextPlots.tr ?? nextPlots.en ?? null;
    const plotLang = plot ? (nextPlots.tr === plot ? 'tr' : 'en') : null;
    return { ...cache[movie.id], plot, plotLang };
  }

  /* yerel (elle eklenen) kayıtlar: adıyla IMDb'de eşleştir,
     afiş + özet bilgisini zenginleştirilmiş döndür */
  const results = await searchImdb(movie.title).catch(() => []);
  const best = results.find((r) => r.image) ?? results[0] ?? null;
  const res = await fetchWikiPlot(movie.title, movie, lang).catch(() => null);
  return {
    ...movie,
    image: movie.image ?? best?.image ?? null,
    imdbId: best?.id?.startsWith('tt') ? best.id : null,
    plot: res?.plot ?? null,
    plotLang: res?.plotLang ?? null,
  };
}
