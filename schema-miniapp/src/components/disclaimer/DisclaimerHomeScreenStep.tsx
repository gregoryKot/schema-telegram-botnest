import { useTr } from '../../utils/addressForm';

// Последний шаг онбординга: «добавь на главный экран». Показывается только там,
// где нативный экран Telegram корректен (см. utils/homeScreen.ts — на iOS он
// показывает инструкцию про «три точки», а открывает «Поделиться»).
//
// onBeforeAdd персистит согласие ДО вызова addToHomeScreen: Telegram открывает
// свой нативный шит поверх аппки, и пользователь часто уже не возвращается к
// финальной кнопке. Раньше из-за этого согласие терялось.
export function DisclaimerHomeScreenStep({
  onBeforeAdd,
}: {
  onBeforeAdd: () => void;
}) {
  const tr = useTr();
  return (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>📲</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 10,
        }}
      >
        {tr('Добавь на главный экран', 'Добавьте на главный экран')}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.65,
          marginBottom: 28,
        }}
      >
        Так дневник будет всегда под рукой — как обычное приложение. Займёт две
        секунды.
      </div>
      <button
        onClick={() => {
          onBeforeAdd();
          window.Telegram?.WebApp?.addToHomeScreen?.();
        }}
        className="btn-primary"
        style={{ marginBottom: 10 }}
      >
        Добавить на экран
      </button>
    </div>
  );
}
