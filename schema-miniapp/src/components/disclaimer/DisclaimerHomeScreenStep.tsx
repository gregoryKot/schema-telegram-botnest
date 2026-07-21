import { useTr } from '../../utils/addressForm';
import {
  buildHomeScreenHint,
  homeScreenButtonWorks,
} from '../../utils/homeScreen';
import { useHomeScreenOffer } from '../../hooks/useHomeScreenOffer';

// Последний шаг онбординга: «добавь на главный экран».
// На Android — рабочая кнопка (addToHomeScreen). На iOS программный вызов
// молчит (Telegram 9.6 убрал экран добавления), поэтому кнопки нет — только
// инструкция про нативное меню «⋯» (buildHomeScreenHint).
export function DisclaimerHomeScreenStep({
  onBeforeAdd,
}: {
  onBeforeAdd: () => void;
}) {
  const tr = useTr();
  const offer = useHomeScreenOffer('onboarding');
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
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text-faint)',
          lineHeight: 1.6,
          marginBottom: 22,
          textAlign: 'left',
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(var(--fg-rgb),0.05)',
        }}
      >
        {buildHomeScreenHint(offer.platform, tr)}
      </div>
      {/* Кнопка — только на Android (там addToHomeScreen работает). На iOS
          вызов молчит, ведёт к цели инструкция про «⋯» выше. */}
      {homeScreenButtonWorks(offer.platform) && (
        <button
          onClick={() => {
            // addToHomeScreen ПЕРВЫМ, прямо в жесте; согласие сразу после
            // (localStorage синхронный успевает до ухода из аппки).
            window.Telegram?.WebApp?.addToHomeScreen?.();
            onBeforeAdd();
          }}
          className="btn-primary"
          style={{ marginBottom: 10 }}
        >
          Добавить на экран
        </button>
      )}
    </div>
  );
}
