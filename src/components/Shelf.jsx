/* Afiş ızgarası bölümü.
   sortable=true ise başlıkta sıralama seçeneği gösterilir
   (Eklenme sırası / En beğendikler önce / Beğenmedikler önce). */
import { useState } from 'react';
import Book from './Book';
import { t } from '../lib/i18n';

export default function Shelf({ title, items, emptyText, onPick, lang = 'tr', loading, sortable = false }) {
  const [sort, setSort] = useState('added');
  const suffix = t(lang, 'countSuffix');

  const list = (() => {
    if (!sortable || sort === 'added') return items;
    const rated = items.filter((m) => (m.rating ?? 0) > 0);
    const unrated = items.filter((m) => !m.rating);
    const cmp = sort === 'ratingDesc'
      ? (a, b) => b.rating - a.rating
      : (a, b) => a.rating - b.rating;
    return [...rated].sort(cmp).concat(unrated);
  })();

  return (
    <section className="shelf-section">
      <div className="shelf-head">
        <h2 className="shelf-heading">
          {title}
          {typeof items.length === 'number' && (
            <span className="count">{items.length} {suffix}</span>
          )}
        </h2>
        {sortable && items.length > 1 && (
          <select
            className="shelf-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sıralama"
          >
            <option value="added">{t(lang, 'sortAdded')}</option>
            <option value="ratingDesc">{t(lang, 'sortBest')}</option>
            <option value="ratingAsc">{t(lang, 'sortLowest')}</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="poster-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-shelf">{emptyText}</div>
      ) : (
        <div className="poster-grid">
          {list.map((m) => (
            <Book key={m.id} movie={m} onPick={onPick} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}
