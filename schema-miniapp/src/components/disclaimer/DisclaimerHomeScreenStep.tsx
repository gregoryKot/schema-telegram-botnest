// Шаг 4 онбординга Disclaimer: «добавь на главный экран» (только если
// Telegram.WebApp.addToHomeScreen доступен). Перенесено из Disclaimer.tsx
// как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function DisclaimerHomeScreenStep() {
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
        Добавь на главный экран
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
          (window as any).Telegram?.WebApp?.addToHomeScreen();
        }}
        className="btn-primary"
        style={{ marginBottom: 10 }}
      >
        Добавить на экран
      </button>
    </div>
  );
}
