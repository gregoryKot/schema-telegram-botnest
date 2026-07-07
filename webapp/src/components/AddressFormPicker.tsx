import { useEffect, useState } from 'react';
import { api } from '../api';
import { useSetAddressForm } from '../utils/addressForm';

/**
 * Выбор обращения («ты»/«вы») при первом входе — пока addressForm в настройках null.
 * «Позже» = мягкий пропуск: остаётся «ты» по умолчанию, спросим в следующей сессии.
 * Сам грузит настройки; не чаще раза за сессию.
 */
export function AddressFormPicker() {
  const [show, setShow] = useState(false);
  const setForm = useSetAddressForm();

  useEffect(() => {
    if (sessionStorage.getItem('addr_form_asked')) return;
    api.getSettings()
      .then(s => { if (!s.addressForm) setShow(true); })
      .catch(() => {});
  }, []);

  if (!show) return null;

  function close() {
    sessionStorage.setItem('addr_form_asked', '1');
    setShow(false);
  }

  async function choose(form: 'ty' | 'vy') {
    setForm(form);
    try { await api.updateSettings({ addressForm: form }); } catch { /* не блокируем вход */ }
    close();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', borderRadius: 20, padding: 28 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Как удобнее общаться?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 18 }}>
          Поменять можно в любой момент в настройках.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => choose('ty')}
            style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            На «ты»
          </button>
          <button onClick={() => choose('vy')}
            style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            На «вы»
          </button>
        </div>
        <button onClick={close}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Позже
        </button>
      </div>
    </div>
  );
}
