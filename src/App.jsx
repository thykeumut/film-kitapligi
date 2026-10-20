/* Seans — ana uygulama
   Giriş → Kitaplık (Sırada / İzlendi) → Keşfet (Top film / dizi / anime, canlı arama)
   Kitaplık verisi: Supabase (bulut, VITE_SUPABASE_* doluysa) → yoksa yerel demo. */
import { useEffect, useRef, useState } from 'react';
import {
  restoreUser, logout,
  loadData, saveMovies,
  isCloud, collectLocalLibraries,
} from './lib/storage';
import { searchImdb, getDetails } from './lib/imdb';
import { fetchChart } from './lib/charts';
import { unreadCount } from './lib/feedback';
import { t, interpolate } from './lib/i18n';
import Auth from './components/Auth';
import Shelf from './components/Shelf';
import BookModal from './components/BookModal';
import AddMovieModal from './components/AddMovieModal';
import { FeedbackCompose, FeedbackInbox } from './components/FeedbackModal';

const EMPTY_DATA = { movies: [] };
const LANG_KEY = 'fk_lang_v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true); // oturum geri yükleme
  const [data, setData] = useState(EMPTY_DATA);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fbView, setFbView] = useState(null); // null | 'compose' | 'inbox'
  const [unreadN, setUnreadN] = useState(0);
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'tr');

  /* keşfet: Top filmler / Top diziler sekmeleri */
  const [exploreMode, setExploreMode] = useState('film');
  const fetchSeq = useRef(0); // geç fetch'in eski sekmeye yazmasını önler
  const [chart, setChart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fk_chart_view_v2')) ?? null;
    } catch {
      return null;
    }
  });
  const [chartLoading, setChartLoading] = useState(!chart);
  const [chartError, setChartError] = useState(false);

  /* imdb canlı arama */
  const [liveResults, setLiveResults] = useState(null);
  const [liveBusy, setLiveBusy] = useState(false);

  function switchLang(next) {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  }

  /* ------- Top listeleri: localStorage önbelleği + canlı tazeleme ------- */

  const loadChart = async (kind, force = false) => {
    const seq = ++fetchSeq.current; // bu fetch'in sırası
    setChartLoading(true);
    setChartError(false);
    try {
      const items = await fetchChart(kind);
      if (seq !== fetchSeq.current) return; // fetch sürerken sekme değişti
      setChart(items);
      setChartLoading(false);
      localStorage.setItem('fk_chart_view_v2', JSON.stringify(items));
    } catch {
      if (seq !== fetchSeq.current) return;
      if (force) {
        setChartError(true);
        setChartLoading(false);
      } else if (!chart) {
        loadChart(kind, true); // tek sessiz yeniden dene
      } else {
        setChartLoading(false);
      }
    }
  };

  useEffect(() => {
    loadChart(exploreMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreMode]);

  /* secilen sekmenin listesi boyut değiştirirken mevcut cache'i göster */

  /* ------------------ canlı arama (debounce, 350ms) ------------------ */

  useEffect(() => {
    if (!query.trim()) {
      setLiveResults(null);
      setLiveBusy(false);
      return undefined;
    }
    setLiveBusy(true);
    const tmr = setTimeout(() => {
      searchImdb(query)
        .then((rs) => {
          setLiveResults(rs.slice(0, 24));
          setLiveBusy(false);
        })
        .catch(() => {
          setLiveResults([]);
          setLiveBusy(false);
        });
    }, 350);
    return () => clearTimeout(tmr);
  }, [query]);

  /* ------------------------- kullanıcı ve veri ------------------------- */

  /* açılışta oturumu geri getir */
  useEffect(() => {
    let alive = true;
    restoreUser()
      .then((u) => {
        if (alive) {
          setUser(u);
          setBooting(false);
        }
      })
      .catch(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* okunmamış mesaj sayısı (mesaj kutusu rozeti) */
  useEffect(() => {
    if (!user) return undefined;
    unreadCount().then((n) => setUnreadN(n)).catch(() => {});
    return undefined;
  }, [user, fbView]);

  /* kullanıcı değişince kitaplığı yükle */
  useEffect(() => {
    if (!user) {
      setData(EMPTY_DATA);
      return undefined;
    }
    let alive = true;
    loadData(user.id).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  /* bulut girişinde: sunucudaki kitaplık boşsa bu cihazdaki eski
     yerel kitaplığı taşıma teklif et (bir kez) */
  useEffect(() => {
    if (!isCloud() || !user) return undefined;
    let alive = true;
    (async () => {
      const d = await loadData(user.id);
      if (!alive || (d.movies?.length ?? 0) > 0) return;
      const filled = collectLocalLibraries().find((l) => l.movies.length > 0);
      if (!filled) return;
      const msg = interpolate(t(lang, 'authImport'), { n: filled.movies.length });
      if (window.confirm(msg)) {
        await saveMovies(user.id, filled.movies);
        if (alive) setData({ movies: filled.movies });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, lang]);

  /* eski kayıtlar (afişsiz) açılışta IMDb'den zenginleştirilir */
  useEffect(() => {
    if (!user) return undefined;
    const missing = data.movies.filter((m) => !m.image);
    if (missing.length === 0) return undefined;

    let alive = true;
    (async () => {
      for (const m of missing) {
        const d = await getDetails(m, lang).catch(() => null);
        if (!alive) return;
        if (!d?.image) continue;
        setData((prev) => {
          if (!alive) return prev;
          const movies = prev.movies.map((it) =>
            it.id === m.id ? { ...it, image: d.image } : it,
          );
          saveMovies(user.id, movies); // eslint-disable-line react-hooks/exhaustive-deps
          return { ...prev, movies };
        });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, lang]);

  useEffect(() => {
    if (!modal && !addOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setModal(null);
        setAddOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, addOpen]);

  function persist(next) {
    setData(next);
    saveMovies(user.id, next.movies);
  }

  function upsert(movie) {
    const exists = data.movies.some((m) => m.id === movie.id);
    const movies = exists
      ? data.movies.map((m) => (m.id === movie.id ? movie : m))
      : [...data.movies, { ...movie, addedAt: movie.addedAt ?? Date.now() }];
    persist({ ...data, movies });
  }

  function removeMovie(id) {
    persist({ ...data, movies: data.movies.filter((m) => m.id !== id) });
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setQuery('');
    setModal(null);
    setAddOpen(false);
  }

  function handleAuthed(u) {
    setUser(u);
    setQuery('');
  }

  /* ------------------------- bölme ve filtreleme ------------------------- */

  const q = query.trim().toLowerCase();
  const matches = (m) => !q || m.title.toLowerCase().includes(q);

  const libraryMatched = data.movies.filter(matches);
  const queueItems = libraryMatched.filter((m) => m.status === 'towatch');
  const watchedItems = libraryMatched.filter((m) => m.status === 'watched');
  const watchedCount = data.movies.filter((m) => m.status === 'watched').length;
  const queueCount = data.movies.length - watchedCount;

  const libraryIds = new Set(data.movies.map((m) => m.id));

  const exploreItems = (liveResults ?? chart)?.filter((r) => !libraryIds.has(r.id)) ?? [];
  const exploreTitle = q
    ? interpolate(t(lang, 'exploreSearch'), { q: query })
    : (exploreMode === 'film'
      ? t(lang, 'exploreFilm')
      : exploreMode === 'anime'
        ? t(lang, 'exploreAnime')
        : t(lang, 'exploreSeries'));
  const exploreLoading = q ? liveBusy : chartLoading;

  const modalIsNew = modal && !libraryIds.has(modal.id);

  if (booting) {
    return (
      <div className="landing">
        <div className="landing-inner">
          <h1 className="landing-title">{t(lang, 'appName')}</h1>
          <p className="landing-sub" style={{ opacity: 0.5 }}>
            {t(lang, 'explorePreparing')}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthed={handleAuthed} lang={lang} />;
  }

  return (
    <div className="app-container">
      {/* ---------------- üst bar ---------------- */}
      <header className="topbar">
        <div className="topbar-brand">{t(lang, 'appName')}</div>
        <div className="topbar-mid">
          <div className="topbar-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              aria-label="Ara"
            />
          </div>
        </div>
        <div className="topbar-user">
          <span>{user.username}</span>
          <button
            type="button"
            className="btn btn--ghost btn--small btn--lang"
            onClick={() => switchLang(lang === 'tr' ? 'en' : 'tr')}
            title={lang === 'tr' ? 'Switch to English' : 'Türkçe\u2019ye geç'}
          >
            {t(lang, 'langBtn')}
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setFbView('compose')}>
            {t(lang, 'fbBtn')}
          </button>
          {user.username?.toLowerCase() === 'thyke' && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setFbView('inbox')}
              style={{ position: 'relative' }}
            >
              {t(lang, 'fbInbox')}
              {unreadN > 0 && (
                <span
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#e4583d', color: '#fff', borderRadius: 999,
                    fontSize: '0.65rem', padding: '0.1rem 0.38rem', fontWeight: 700,
                  }}
                >
                  {unreadN}
                </span>
              )}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--small" onClick={handleLogout}>
            {t(lang, 'logout')}
          </button>
        </div>
      </header>

      {/* ---------------- sayfa ---------------- */}
      <main className="library-page">
        <div className="stats-row">
          <div className="stat-chip">
            <div className="stat-num">{data.movies.length}</div>
            <div className="stat-label">{t(lang, 'statTotal')}</div>
          </div>
          <div className="stat-chip">
            <div className="stat-num">{queueCount}</div>
            <div className="stat-label">{t(lang, 'statQueue')}</div>
          </div>
          <div className="stat-chip">
            <div className="stat-num">{watchedCount}</div>
            <div className="stat-label">{t(lang, 'statWatched')}</div>
          </div>
          <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <button type="button" className="btn" onClick={() => setAddOpen(true)}>
              {t(lang, 'addTitle')}
            </button>
          </div>
        </div>

        <Shelf
          title={t(lang, 'queueShelf')}
          items={queueItems}
          emptyText={t(lang, 'emptyQueue')}
          onPick={setModal}
          lang={lang}
        />

        <Shelf
          title={t(lang, 'watchedShelf')}
          items={watchedItems}
          emptyText={t(lang, 'emptyWatched')}
          onPick={setModal}
          lang={lang}
        />

        {/* ----- keşfet: sekme + ızgara ----- */}
        {!q && (
          <div className="explore-tabs">
            <button
              type="button"
              className={exploreMode === 'film' ? 'active' : ''}
              onClick={() => setExploreMode('film')}
            >
              {t(lang, 'tabFilm')}
            </button>
            <button
              type="button"
              className={exploreMode === 'dizi' ? 'active' : ''}
              onClick={() => setExploreMode('dizi')}
            >
              {t(lang, 'tabSeries')}
            </button>
            <button
              type="button"
              className={exploreMode === 'anime' ? 'active' : ''}
              onClick={() => setExploreMode('anime')}
            >
              {t(lang, 'tabAnime')}
            </button>
          </div>
        )}

        <Shelf
          title={exploreTitle}
          items={exploreItems}
          emptyText={
            chartError
              ? t(lang, 'exploreError')
              : q
                ? t(lang, 'exploreNoResults')
                : t(lang, 'explorePreparing')
          }
          onPick={setModal}
          lang={lang}
          loading={exploreLoading}
        />

        {chartError && !q && (
          <div style={{ textAlign: 'center', marginTop: '-1.5rem' }}>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => loadChart(exploreMode, true)}
            >
              {t(lang, 'retry')}
            </button>
          </div>
        )}
      </main>

      {/* ---------------- modallar ---------------- */}
      {modal && (
        <BookModal
          movie={modal}
          isNew={modalIsNew}
          lang={lang}
          onSave={(movie) => upsert(movie)}
          onRemove={modalIsNew ? null : () => removeMovie(modal.id)}
          onClose={() => setModal(null)}
        />
      )}

      {addOpen && (
        <AddMovieModal
          onAdd={(movie) => upsert(movie)}
          onClose={() => setAddOpen(false)}
          lang={lang}
        />
      )}

      {fbView === 'compose' && (
        <FeedbackCompose
          open
          lang={lang}
          from={user?.username ?? null}
          onClose={() => setFbView(null)}
        />
      )}
      {fbView === 'inbox' && (
        <FeedbackInbox open lang={lang} onClose={() => setFbView(null)} />
      )}
    </div>
  );
}
