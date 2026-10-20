/* Kitap detay modalı — afiş, dil-bilinçli özet, IMDb bağlantısı + durum/puan/not.
   Afişin baskın rengi çıkarılıp modal vurgusua (--modal-accent) uygulanır;
   çıkarılamazsa tür rengine düşer (film: amber, dizi: turkuaz, anime: mor). */
import { useEffect, useState } from 'react';
import { getDetails, imdbUrl } from '../lib/imdb';
import { t } from '../lib/i18n';

const TYPE_ACCENTS = { film: '#e8b54c', dizi: '#7fd0cf', anime: '#d99cf2' };

/* posterin baskın rengi — canvas ile; CORS kapalıysa sessizce null */
function extractAccent(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (c) => {
      if (!done) {
        done = true;
        resolve(c);
      }
    };
    img.onload = () => {
      try {
        const W = 24;
        const H = 36;
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const buckets = new Map();
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i] / 255;
          const g = px[i + 1] / 255;
          const b = px[i + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;
          const s = max - min;
          if (s < 0.06 || l < 0.12 || l > 0.9) continue; // soluk/siyah/beyaz alanları yok say
          let h;
          if (max === r) h = 60 * (((g - b) / s) % 6);
          else if (max === g) h = 60 * ((b - r) / s + 2);
          else h = 60 * ((r - g) / s + 4);
          if (h < 0) h += 360;
          const bucket = Math.round(h / 15) * 15;
          const score = s * (1 - Math.abs(l - 0.5) * 2);
          const e = buckets.get(bucket) ?? { w: 0, h: 0, s: 0, l: 0 };
          e.w += score;
          e.h += h * score;
          e.s += s * score;
          e.l += l * score;
          buckets.set(bucket, e);
        }
        let best = null;
        for (const e of buckets.values()) if (!best || e.w > best.w) best = e;
        if (!best || best.w < 0.5) return finish(null);
        const sat = Math.min(0.82, Math.max(0.4, best.s / best.w));
        const lig = Math.min(0.6, Math.max(0.46, best.l / best.w));
        finish(`hsl(${Math.round(best.h / best.w)} ${Math.round(sat * 100)}% ${Math.round(lig * 100)}%)`);
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 6000);
    img.src = url;
  });
}

export default function BookModal({ movie, isNew, onSave, onRemove, onClose, lang = 'tr' }) {
  const [status, setStatus] = useState(movie.status ?? 'towatch');
  const [note, setNote] = useState(movie.note ?? '');
  const [rating, setRating] = useState(movie.rating ?? 0);
  const [details, setDetails] = useState(null);
  const [plotState, setPlotState] = useState('loading'); // loading | ok | none
  const [tint, setTint] = useState(null);

  useEffect(() => {
    setStatus(movie.status ?? 'towatch');
    setNote(movie.note ?? '');
    setRating(movie.rating ?? 0);
    setDetails(null);
    setPlotState('loading');

    let alive = true;
    getDetails(movie, lang)
      .then((d) => {
        if (!alive) return;
        setDetails(d);
        setPlotState(d?.plot ? 'ok' : 'none');
      })
      .catch(() => {
        if (alive) setPlotState('none');
      });
    return () => {
      alive = false;
    };
  }, [movie, lang]);

  /* afişin baskın rengi → modal vurgusu */
  useEffect(() => {
    setTint(null);
    let alive = true;
    if (movie.image) {
      extractAccent(movie.image).then((c) => {
        if (alive) setTint(c);
      });
    }
    return () => {
      alive = false;
    };
  }, [movie.id, movie.image]);

  function save() {
    onSave({
      ...movie,
      image: movie.image ?? details?.image ?? null,
      status,
      note,
      rating: status === 'watched' ? rating : 0,
      watchedAt: status === 'watched' ? (movie.watchedAt ?? Date.now()) : null,
    });
    onClose();
  }

  const shown = details ?? movie;
  const imdbId = movie.id?.startsWith('tt') ? movie.id : details?.imdbId;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card modal-card--rich"
        style={{ '--modal-accent': tint ?? TYPE_ACCENTS[movie.type] ?? TYPE_ACCENTS.film }}
      >
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Kapat">
          ×
        </button>

        <div className="modal-hero">
          <div className="modal-poster">
            {shown.image ? (
              <img src={shown.image} alt="" />
            ) : (
              <div className="modal-poster-none">{(shown.title ?? '?').slice(0, 2)}</div>
            )}
          </div>
          <div className="modal-info">
            <h2 className="modal-title">{shown.title}</h2>
            <p className="modal-sub">
              {shown.year ?? '—'} ·{' '}
              <span className={`type-tag t-${shown.type}`}>
                {shown.type === 'anime' ? t(lang, 'labelAnime') : shown.type === 'dizi' ? t(lang, 'labelSeries') : t(lang, 'labelFilm')}
              </span>
              {isNew ? ` · ${t(lang, 'notInLibrary')}` : ''}
            </p>

            <div className="plot">
              {plotState === 'loading' && <span className="plot-loading">{t(lang, 'plotLoading')}</span>}
              {plotState === 'ok' && (
                <>
                  <p className="plot-text">{details.plot}</p>
                  {details.plotLang && details.plotLang !== lang && (
                    <span className="plot-lang-note">{t(lang, 'plotFallbackNote')}</span>
                  )}
                </>
              )}
              {plotState === 'none' && (
                <p className="plot-text plot-text--none">{t(lang, 'plotNone')}</p>
              )}
            </div>

            {imdbId && (
              <a className="imdb-link" href={imdbUrl(imdbId)} target="_blank" rel="noreferrer">
                {t(lang, 'modalOpenImdb')}
              </a>
            )}
          </div>
        </div>

        <div className="add-label">{t(lang, 'modalStatus')}</div>
        <div className="status-seg">
          <button
            type="button"
            className={status === 'towatch' ? 'active' : ''}
            onClick={() => setStatus('towatch')}
          >
            {t(lang, 'modalQueue')}
          </button>
          <button
            type="button"
            className={status === 'watched' ? 'active' : ''}
            onClick={() => setStatus('watched')}
          >
            {t(lang, 'modalWatched')}
          </button>
        </div>

        {status === 'watched' && (
          <div className="rating-row">
            <span className="add-label plain">{t(lang, 'modalMyRating')}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`star ${n <= rating ? 'lit' : ''}`}
                onClick={() => setRating(n)}
                aria-label={`${n} ${lang === 'tr' ? 'yıldız' : 'stars'}`}
              >
                ★
              </button>
            ))}
          </div>
        )}

        <div className="modal-note">
          <label className="modal-note-label" htmlFor="bkm-note">
            {t(lang, 'modalNote')}
          </label>
          <textarea
            id="bkm-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(lang, 'modalNotePlaceholder')}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={save}>
            {isNew ? t(lang, 'modalAdd') : t(lang, 'modalSave')}
          </button>
          {onRemove && (
            <button
              type="button"
              className="danger-link"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              {t(lang, 'modalRemove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
