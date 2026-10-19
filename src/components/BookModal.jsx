/* Kitap detay modalı — afiş, dil-bilinçli özet, IMDb bağlantısı + durum/puan/not. */
import { useEffect, useState } from 'react';
import { getDetails, imdbUrl } from '../lib/imdb';
import { t } from '../lib/i18n';

export default function BookModal({ movie, isNew, onSave, onRemove, onClose, lang = 'tr' }) {
  const [status, setStatus] = useState(movie.status ?? 'towatch');
  const [note, setNote] = useState(movie.note ?? '');
  const [rating, setRating] = useState(movie.rating ?? 0);
  const [details, setDetails] = useState(null);
  const [plotState, setPlotState] = useState('loading'); // loading | ok | none

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
      <div className="modal-card modal-card--rich">
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
              {shown.year ?? '—'} · {shown.type === 'dizi' ? t(lang, 'labelSeries') : t(lang, 'labelFilm')}
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
