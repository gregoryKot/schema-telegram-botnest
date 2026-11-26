// Экран «сервер не отвечает» — тексты и смысл повтора в одном месте (правило №3 CLAUDE.md).
//
// Перенесено из webapp/src/components/ConnectionTrouble.tsx (инцидент
// 31.08.2026: авария БД → refresh отвечал 500 → мини-апп красил это как
// «Не удалось войти» с подсказкой про Telegram, хотя вход не сломан, сломан
// сервер). Обёртка фронтенда решает, ЧТО значит retry (сайт — refreshToken()
// из AuthContext) и КАК экран выглядит: сайт передаёт `Frame` — лист исхода
// «на нашей стороне» (webapp PaperOutcome); shared не импортирует webapp.
//
// Показывается ДО входа/при недоступной сессии — AddressFormProvider ещё не
// смонтирован (сайт: authError==='transient' рендерится вне него, см.
// App.tsx). Форма обращения — из кэша (readCachedForm), как в AuthFailureHelp.
import type { ComponentType } from 'react';
import { pickForm } from '../utils/addressForm';
import { readCachedForm } from '../utils/addressFormCache';

/** Что экран показывает — одинаково в любом оформлении. */
export interface ConnectionTroubleView {
  title: string;
  lead: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}

export interface ConnectionTroubleProps {
  /** Повторить попытку — что именно это значит, решает вызывающий фронтенд. */
  onRetry: () => void;
  /** Повтор уже идёт — кнопка блокируется, чтобы не наплодить параллельных попыток. */
  retrying?: boolean;
  /** Оформление фронтенда; без него — простой экран на классах ds-* (запасной: сайт передаёт свой). */
  Frame?: ComponentType<ConnectionTroubleView>;
}

export function ConnectionTrouble({
  onRetry,
  retrying = false,
  Frame,
}: ConnectionTroubleProps) {
  const view: ConnectionTroubleView = {
    title: 'Сервер не отвечает',
    lead: pickForm(
      readCachedForm(),
      'Это на нашей стороне — вход не слетел. Попробуй ещё раз через минуту.',
      'Это на нашей стороне — вход не слетел. Попробуйте ещё раз через минуту.',
    ),
    retryLabel: retrying ? 'Проверяем…' : 'Повторить',
    retrying,
    onRetry,
  };
  if (Frame) return <Frame {...view} />;
  return (
    <div role="alert">
      <h1 className="ds-h2">{view.title}</h1>
      <p className="ds-sub">{view.lead}</p>
      <button
        type="button"
        className="ds-btn"
        onClick={onRetry}
        disabled={retrying}
        aria-busy={retrying || undefined}
      >
        {view.retryLabel}
      </button>
    </div>
  );
}
