/* Yapım ekleme modalı — IMDb'de arar, karşılığı seçtirir. */
import { useEffect, useRef, useState } from 'react';
import { searchImdb } from '../lib/imdb';
import { t } from '../lib/i18n';

export default function AddMovieModal({ onAdd, onClose, lang = 'tr' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('towatch');
  const [selected, setSelected] = useState(null);
  const [manual, setManual] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2 || manual) {
      setResults(null);
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    timer.current = setTimeout(() => {
      searchImdb(q)
        .then((rs) => {
          setResults(rs.slice(0, 12));
          setBusy(false);
        })
        .catch(() => {
          setResults([]);
          setBusy(false);
        });
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query, manual]);

  function submit(e) {
    e.preventDefault();
    if (!manual && selected) {
      onAdd({ ...selected, status, note: '', rating: 0 });
      onClose();
      return;
    }
    if (manual && query.trim()) {
      onAdd({
        id: `u_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e8).toString(36)}`,
        title: query.trim(),
        year: null,
        type: 'film',
        image: null,
        status,
        note: '',
        rating: 0,
      });
      onClose();
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Kapat">
          ×
        </button>

        <h2 className="modal-title">{t(lang, 'addTitle')}</h2>
        <p className="modal-sub">{t(lang, 'addSub')}</p>

        <form className="add-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="am-title">{t(lang, 'addSearchLabel')}</label>
            <input
              id="am-title"
              type="text"
              value={query}
              onChange={(e) => (setQuery(e.target.value), setSelected(null))}
              placeholder={t(lang, 'addSearchPlaceholder')}
              autoFocus
            />
          </div>

          {busy && <div className="search-status">{t(lang, 'addSearching')}</div>}
          {results && results.length === 0 && !busy && !manual && (
            <div className="search-status">{t(lang, 'addNoResults')}</div>
          )}

          {results && results.length > 0 && !manual && (
            <div className="search-list">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`search-item ${selected?.id === r.id ? 'selected' : ''}`}
                  onClick={() => (setSelected(r), setQuery(r.title))}
                >
                  {r.image ? (
                    <img src={r.image} alt="" loading="lazy" />
                  ) : (
                    <span className="search-item-noimg">
                      {(r.title ?? '??').slice(0, 2)}
                    </span>
                  )}
                  <span className="search-item-txt">
                    <strong>{r.title}</strong>
                    <small>
                      {r.year ?? '—'} · {r.type === 'dizi' ? t(lang, 'labelSeries') : t(lang, 'labelFilm')}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {manual && (
            <div className="field">
              <label htmlFor="am-manual-title">{lang === 'tr' ? 'Başlık' : 'Title'}</label>
              <input
                id="am-manual-title"
                type="text"
                value={selected?.title ?? query}
                onChange={(e) => (setManual(true), setSelected({ title: e.target.value, type: 'film' }))}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="am-status">{t(lang, 'addStatus')}</label>
            <select id="am-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="towatch">{t(lang, 'modalQueue')}</option>
              <option value="watched">{t(lang, 'modalWatched')}</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn" disabled={!query.trim()}>
              {!manual && selected ? t(lang, 'modalAdd') : t(lang, 'addManual')}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setManual((v) => !v)}
            >
              {manual
                ? (lang === 'tr' ? 'IMDb aramasına dön' : 'Back to IMDb search')
                : (lang === 'tr' ? 'Elle ekle' : 'Add manually')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t(lang, 'addCancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
