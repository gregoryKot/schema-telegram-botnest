import { useTr } from '../../utils/addressForm';
import { welcomeTexts } from '../../../../shared/src/onboarding/consents';

// Шаг 0 онбординга Disclaimer: приветствие. Форма обращения ты/вы уже выбрана
// на предыдущем шаге (AddressFormPicker) — приветствие звучит в ней.
export function DisclaimerWelcomeStep() {
  const t = welcomeTexts(useTr());
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 4 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 14,
          }}
        >
          {t.title}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 'var(--r-20)',
            padding: '3px 12px',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-yellow)',
            letterSpacing: '0.1em',
          }}
        >
          {t.beta}
        </div>
      </div>
      <div
        className="card"
        style={{
          borderRadius: 'var(--r-16)',
          padding: '16px 18px',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          {t.greeting}
        </div>
      </div>
      <div
        className="card"
        style={{ borderRadius: 'var(--r-16)', padding: '16px 18px' }}
      >
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}
        >
          {t.intro}
          <br />
          <br />
          {t.outro}
        </div>
      </div>
    </div>
  );
}
