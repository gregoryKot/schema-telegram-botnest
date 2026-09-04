// Экран «сервер не отвечает» — один на оба фронтенда (правило №3 CLAUDE.md).
//
// Перенесено из webapp/src/components/ConnectionTrouble.tsx (инцидент
// 31.08.2026: авария БД → refresh отвечал 500 → мини-апп красил это как
// «Не удалось войти» с подсказкой про Telegram, хотя вход не сломан, сломан
// сервер). У сайта для authError==='transient' уже был этот экран — теперь
// его логика в shared, а frontend-обёртки только решают, ЧТО значит retry
// (сайт — refreshToken() из AuthContext, мини-апп — renewSession() +
// перезагрузка данных).
//
// Показывается ДО входа/при недоступной сессии — AddressFormProvider ещё не
// смонтирован (сайт: authError==='transient' рендерится вне него, см.
// App.tsx; мини-апп: экран ошибки — тоже до полного старта приложения).
// Форма обращения — из кэша (readCachedForm), как в AuthFailureHelp.
import { pickForm } from '../utils/addressForm';
import { readCachedForm } from '../utils/addressFormCache';

export interface ConnectionTroubleProps {
  /** Повторить попытку — что именно это значит, решает вызывающий фронтенд. */
  onRetry: () => void;
  /** Повтор уже идёт — кнопка блокируется, чтобы не наплодить параллельных попыток. */
  retrying?: boolean;
}

export function ConnectionTrouble({
  onRetry,
  retrying,
}: ConnectionTroubleProps) {
  const tr = (ty: string, vy: string) => pickForm(readCachedForm(), ty, vy);
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 16,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
        Сервер не отвечает
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {tr(
          'Это на нашей стороне — вход не слетел. Попробуй ещё раз через минуту.',
          'Это на нашей стороне — вход не слетел. Попробуйте ещё раз через минуту.',
        )}
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        style={{
          padding: '10px 24px',
          border: 'none',
          borderRadius: 'var(--r-8)',
          background: 'var(--text)',
          color: 'var(--bg)',
          fontSize: 14,
          fontWeight: 600,
          cursor: retrying ? 'default' : 'pointer',
          opacity: retrying ? 0.6 : 1,
        }}
      >
        {retrying ? 'Проверяем…' : 'Повторить'}
      </button>
    </div>
  );
}
