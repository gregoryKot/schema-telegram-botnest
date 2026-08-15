import { useTr } from '../utils/addressForm';

interface Props {
  ty: string;
  vy: string;
  // Инфинитив («Проверить снова», «Отправить ещё раз») — форма-нейтральный,
  // ты/вы разводить не нужно (нет личного окончания).
  retryLabel: string;
  onRetry: () => void;
}

// Баннер сетевого сбоя с кнопкой повтора для теста на схемы — единственная
// копия (правило №3), раньше жила только в schema-miniapp: проверка
// сохранённого на сервере прогресса (YsqIntro) и отправка результата
// (YsqResultView) молчали на сайте (нарушение правила 14 — экран-тупик без
// сигнала). Оба фронтенда рендерят этот компонент напрямую (образец
// CopyFailedHint — useTr берётся из общего контекста, без обёртки на фронт).
export function YsqSyncErrorNote({ ty, vy, retryLabel, onRetry }: Props) {
  const tr = useTr();
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,100,100,0.8)',
          marginBottom: 10,
        }}
      >
        {tr(ty, vy)}
      </div>
      <button
        onClick={onRetry}
        style={{
          width: '100%',
          padding: '11px 0',
          border: 'none',
          borderRadius: 12,
          background: 'rgba(255,100,100,0.12)',
          color: 'var(--accent-red)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {retryLabel}
      </button>
    </div>
  );
}
