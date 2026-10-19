/* Afiş ızgarası bölümü. */
import Book from './Book';
import { t } from '../lib/i18n';

export default function Shelf({ title, items, emptyText, onPick, lang = 'tr', loading }) {
  const suffix = t(lang, 'countSuffix');
  return (
    <section className="shelf-section">
      <div className="shelf-head">
        <h2 className="shelf-heading">
          {title}
          {typeof items.length === 'number' && (
            <span className="count">{items.length} {suffix}</span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="poster-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-shelf">{emptyText}</div>
      ) : (
        <div className="poster-grid">
          {items.map((m) => (
            <Book key={m.id} movie={m} onPick={onPick} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}
