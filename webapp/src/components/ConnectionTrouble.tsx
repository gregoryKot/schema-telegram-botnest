import { useAuth } from '../auth/authContext';
import { pickForm } from '../../../shared/src/utils/addressForm';
import { readCachedForm } from '../../../shared/src/utils/addressFormCache';

// Сеть/5xx на refresh (authError==='transient') — это НЕ «сессии нет»: раньше
// сайт в этом случае редиректил на /login поверх живой 30-дневной куки
// (диагностика «постоянно нужно логиниться заново», 2026-08-21). Вынесено из
// App.tsx (файл-храповик, правило №10 CLAUDE.md). Форма обращения — из кэша
// (readCachedForm), AddressFormProvider тут ещё нет: экран до входа.
export function ConnectionTrouble() {
  const { refreshToken } = useAuth();
  const tr = (ty: string, vy: string) => pickForm(readCachedForm(), ty, vy);
  return (
    <div className="loader-center" style={{ flexDirection: 'column', gap: 16, textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Нет связи с сервером</div>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {tr('Проверь подключение и попробуй ещё раз', 'Проверьте подключение и попробуйте ещё раз')}
      </div>
      <button
        onClick={() => void refreshToken()}
        style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        Повторить
      </button>
    </div>
  );
}
