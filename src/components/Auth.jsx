/* Kullanıcı kayıt/giriş ekranı. */
import { useState } from 'react';
import { login, register } from '../lib/storage';
import { t } from '../lib/i18n';

export default function Auth({ onAuthed, lang = 'tr' }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);

    try {
      const res =
        mode === 'login'
          ? await login(username, password)
          : await register(username, password);
      if (res.ok) onAuthed(res.user);
      else setError(t(lang, res.error));
    } catch {
      setError(t(lang, 'authErrorUnknown'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1 className="landing-title">
          {lang === 'tr' ? 'Film' : 'Film'} <span>{t(lang, 'appName').split(' ').pop()}</span>
        </h1>
        <p className="landing-sub">{t(lang, 'authTagline')}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => (setMode('login'), setError(''))}
          >
            {t(lang, 'authLogin')}
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => (setMode('register'), setError(''))}
          >
            {t(lang, 'authRegister')}
          </button>
        </div>

        <div className="auth-card">
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="auth-username">{t(lang, 'authUserLabel')}</label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t(lang, 'authUserPlaceholder')}
              />
            </div>

            <div className="field">
              <label htmlFor="auth-password">{t(lang, 'authPassLabel')}</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn" disabled={busy}>
              {mode === 'login' ? t(lang, 'authSubmitLogin') : t(lang, 'authSubmitRegister')}
            </button>
          </form>
        </div>

        <p className="auth-note">{t(lang, 'authNote')}</p>
      </div>
    </div>
  );
}
