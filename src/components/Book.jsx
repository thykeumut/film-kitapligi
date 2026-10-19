/* Afiş kartı — tıklanınca detay modalı açılır.
   status === 'watched' ise solgun filtre + uçuşan toz zerreleri. */
import { useState } from 'react';
import { t } from '../lib/i18n';

const FALLBACK_HUES = [22, 8, 42, 200, 262, 348, 88, 173];

export default function Book({ movie, onPick, lang = 'tr' }) {
  const watched = movie.status === 'watched';
  const hue = FALLBACK_HUES[hashStr(movie.id ?? movie.title) % FALLBACK_HUES.length];
  const seq = hashStr(movie.id ?? movie.title) % 6;
  const [imgFailed, setImgFailed] = useState(false);

  const cls = [
    'card',
    watched ? 'card--dusty' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={() => onPick(movie)}
      title={`${movie.title} (${movie.year ?? ''})`.trim()}
      aria-label={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`}
    >
      <span className="card-imgbox">
        {movie.image && !imgFailed ? (
          <img
            className="card-img"
            src={movie.image}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            className="card-img card-img--fallback"
            style={{ '--h': hue }}
            aria-hidden="true"
          >
            {movie.title}
          </span>
        )}
        {watched && (
          <>
            <span className="dust-scrim" aria-hidden="true" />
            <span className="dust-field" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="dust-dot" style={dustStyle(i, seq)} />
              ))}
            </span>
            <span className="card-badge">{t(lang, 'badgeWatched')}</span>
          </>
        )}
      </span>
      <span className="card-label">
        <span className="card-title">{movie.title}</span>
        <span className="card-meta">
          {(movie.type === 'dizi' ? t(lang, 'typeSeries') : t(lang, 'typeFilm'))}
          {movie.year ? ` \u00b7 ${movie.year}` : ''}
        </span>
      </span>
    </button>
  );
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function dustStyle(i, seq) {
  const jitter = (n) => ((n * 97 + 13) * 31) % 997;
  return {
    left: `${(jitter(i + seq + 1) % 88) + 4}%`,
    top: `${(jitter(i * 3 + seq) % 70) + 4}%`,
    animationDelay: `${(((i + seq) * 0.63) % 4).toFixed(2)}s`,
    animationDuration: `${(3.5 + (i % 4) * 0.8).toFixed(1)}s`,
  };
}
