import { useTr } from '../../utils/addressForm';
import { buildHomeScreenHint } from '../../utils/homeScreen';
import { useHomeScreenOffer } from '../../hooks/useHomeScreenOffer';

// Последний шаг онбординга: «добавь на главный экран» (Android и iOS).
// Нативная картинка Telegram на iOS показывает Android-инструкцию про «три
// точки», а открывает «Поделиться» — поэтому СВОЮ подводку даём заранее
// (buildHomeScreenHint), чтобы человек не растерялся от чужого экрана.
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
      <button
        onClick={() => {
          // addToHomeScreen ПЕРВЫМ, прямо в жесте (как в исходной рабочей
          // версии): на iOS предшествующий fetch (onBeforeAdd → acceptDisclaimer)
          // «съедает» user-gesture, и нативный экран не открывается. Согласие
          // персистим сразу после — localStorage синхронный, успевает до ухода.
          window.Telegram?.WebApp?.addToHomeScreen?.();
          onBeforeAdd();
        }}
        className="btn-primary"
        style={{ marginBottom: 10 }}
      >
        Добавить на экран
      </button>
    </div>
  );
}
