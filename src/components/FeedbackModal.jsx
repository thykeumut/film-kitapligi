/* Geri bildirim pencereleri — mod: 'compose' (gönderim) | 'inbox' (gelenler) */
import { useEffect, useState } from 'react';
import {
  OWNER,
  sendFeedback,
  listFeedback,
  markRead,
} from '../lib/feedback';
import { t } from '../lib/i18n';

export function FeedbackCompose({ open, onClose, lang, from }) {
  const [body, setBody] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    const res = await sendFeedback(from, body);
    if (res.ok) {
      setBody('');
      setState('ok');
      setTimeout(() => {
        setState('idle');
        onClose();
      }, 1400);
    } else {
      setState('err');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <h2 className="modal-title">{t(lang, 'fbTitle')}</h2>
        <p className="modal-sub">{t(lang, 'fbSub')}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fb-who">{t(lang, 'fbWho')}</label>
            <input id="fb-who" type="text" value={from || t(lang, 'fbGuest')} readOnly />
          </div>
          <div className="field">
            <label htmlFor="fb-body">{t(lang, 'fbBody')}</label>
            <textarea
              id="fb-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t(lang, 'fbPlaceholder')}
              maxLength={2000}
              required
              style={{ resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn" disabled={state === 'busy'}>
            {state === 'busy' ? t(lang, 'fbSending') : t(lang, 'fbSend')}
          </button>
          {state === 'ok' && <div className="fb-ok">{t(lang, 'fbThanks')}</div>}
          {state === 'err' && (
            <div className="fb-ok" style={{ color: '#ff8f8f' }}>
              {t(lang, 'fbErr')}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function FeedbackInbox({ open, onClose, lang }) {
  const [msgs, setMsgs] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setMsgs(null);
    setLoaded(false);
    listFeedback().then((list) => {
      setMsgs(list);
      setLoaded(true);
    });
    return undefined;
  }, [open]);

  if (!open) return null;

  const unread = (msgs ?? []).filter((m) => !m.read).map((m) => m.id);
  const markAll = async () => {
    await markRead(unread);
    setMsgs((cur) => (cur ?? []).map((m) => ({ ...m, read: true })));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--rich" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <h2 className="modal-title">{t(lang, 'fbInbox')}</h2>
        {!loaded && <p className="modal-sub">{t(lang, 'fbLoading')}</p>}
        {loaded && (msgs ?? []).length === 0 && (
          <p className="modal-sub">{t(lang, 'fbEmpty')}</p>
        )}
        {loaded && (msgs ?? []).length > 0 && (
          <>
            <div className="fb-inbox-list">
              {msgs.map((m) => (
                <div key={m.id} className={`fb-msg ${m.read ? '' : 'fb-msg--unread'}`}>
                  <div className="fb-msg-head">
                    <span className="fb-msg-from">{m.from_username}</span>
                    <span className="fb-msg-date">
                      {new Date(m.created_at).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                    </span>
                  </div>
                  <div className="fb-msg-body">{m.body}</div>
                </div>
              ))}
            </div>
            {unread.length > 0 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={markAll}>
                {t(lang, 'fbMarkAll')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
