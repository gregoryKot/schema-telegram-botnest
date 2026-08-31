import { useTr } from '../../utils/addressForm';

// Шаг 0 онбординга Disclaimer: приветствие. Форма обращения ты/вы уже выбрана
// на предыдущем шаге (AddressFormPicker) — приветствие звучит в ней.
export function DisclaimerWelcomeStep() {
  const tr = useTr();
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
          Всё по схеме
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
          БЕТА-ВЕРСИЯ
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
          {tr(
            'Хорошо, что ты здесь. Замечать свои потребности — это уже немало.',
            'Хорошо, что вы здесь. Замечать свои потребности — это уже немало.',
          )}
        </div>
      </div>
      <div
        className="card"
        style={{ borderRadius: 'var(--r-16)', padding: '16px 18px' }}
      >
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}
        >
          «Всё по схеме» — про схема-терапию. Начать можно с одного случая:
          вспомнить момент, когда что-то задело, и разобрать по шагам. Три
          минуты — и видно, какая часть вышла вперёд и что ей было нужно.
          Дневники, трекер и практики открываются оттуда же, когда понадобятся.
          <br />
          <br />
          {tr(
            'Если чувствуешь, что что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему.',
            'Если чувствуете, что что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему.',
          )}
        </div>
      </div>
    </div>
  );
}
