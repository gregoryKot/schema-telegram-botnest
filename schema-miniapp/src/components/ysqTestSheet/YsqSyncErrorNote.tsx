import { SaveErrorNote } from '../SaveErrorNote';

interface Props {
  ty: string;
  vy: string;
  // Инфинитив («Проверить снова», «Отправить ещё раз») — форма-нейтральный,
  // ты/вы разводить не нужно (нет личного окончания).
  retryLabel: string;
  onRetry: () => void;
}

// Баннер сетевого сбоя с кнопкой повтора — общий для двух мест в тесте на
// схемы, где молчаливый .catch(() => {}) раньше прятал провал: проверка
// сохранённого на сервере прогресса (YsqIntro) и отправка результата
// (YsqResultView). Правило «одна механика — один компонент»: вместо двух
// копий одного и того же баннера — один переиспользуемый.
export function YsqSyncErrorNote({ ty, vy, retryLabel, onRetry }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <SaveErrorNote ty={ty} vy={vy} />
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
