/* Yakında vizyon takvimi — tarih başlıkları + ufak kart dizileri. */
import { useEffect, useState } from 'react';
import { fetchUpcoming } from '../lib/upcoming';
import Book from './Book';
import { t } from '../lib/i18n';

export default function ComingCalendar({ onPick, lang = 'tr' }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchUpcoming(14)
      .then((g) => {
        if (alive) {
          setGroups(g);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fmt = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    const dayName = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long' });
    const dateName = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long' });
    return `${dateName} · ${dayName}`;
  };

  if (error) {
    return (
      <div className="empty-shelf">
        {t(lang, 'upcomingError')}
        <div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            style={{ marginTop: '0.8rem' }}
            onClick={() => {
              setError(false);
              setGroups(null);
              fetchUpcoming(14).then(setGroups).catch(() => setError(true));
            }}
          >
            {t(lang, 'retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!groups) {
    return (
      <div className="calendar">
        {Array.from({ length: 3 }, (_, i) => (
          <section className="calendar-day" key={i}>
            <h2 className="shelf-heading calendar-heading">
              <span className="skeleton skeleton-line" />
            </h2>
            <div className="calendar-row">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="skeleton calendar-skel" />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return <div className="empty-shelf">{t(lang, 'upcomingEmpty')}</div>;
  }

  return (
    <div className="calendar">
      {groups.map((g) => (
        <section className="calendar-day" key={g.date}>
          <h2 className="shelf-heading calendar-heading">
            {fmt(g.date)}
            <span className="count">{g.items.length}</span>
          </h2>
          <div className="calendar-row">
            {g.items.map((m) => (
              <div key={`${g.date}-${m.id}`} className="calendar-card">
                <Book movie={m} onPick={onPick} lang={lang} />
                {m.extra && (
                  <div className="upcoming-ep" title={m.extra}>
                    {m.extra}
                  </div>
                )}
                {m.type === 'film' && (
                  <div className="upcoming-ep">{t(lang, 'upcomingFilm')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
