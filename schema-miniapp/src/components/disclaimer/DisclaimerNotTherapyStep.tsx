import { DisclaimerCheckbox } from './DisclaimerCheckbox';
import { useTr } from '../../utils/addressForm';

// Последний шаг с галочкой: «это не терапия». На нём же — гейт согласий
// (дальше не пускаем, пока обе галочки не стоят), поэтому здесь живёт
// напоминание про пропущенную галочку предыдущего шага.
export function DisclaimerNotTherapyStep({
  c1,
  setC1,
  ready,
  c2,
}: {
  c1: boolean;
  setC1: (updater: (p: boolean) => boolean) => void;
  ready: boolean;
  c2: boolean;
}) {
  const tr = useTr();
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        Важно знать
      </div>
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'rgba(var(--fg-rgb),0.7)',
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          «Всё по схеме» — инструмент самоисследования. Оценки, тесты и
          упражнения внутри{' '}
          <strong style={{ color: 'var(--text)' }}>
            не являются клинической диагностикой
          </strong>{' '}
          и не заменяют работу с психологом.
        </div>
        <DisclaimerCheckbox
          checked={c1}
          onToggle={() => setC1((p) => !p)}
          label="Я понимаю, что это инструмент самоисследования, а не клиническая диагностика"
        />
      </div>
      {!ready && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent-orange)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {!c2 && !c1
            ? tr(
                'Отметь оба согласия — здесь и на предыдущем шаге',
                'Отметьте оба согласия — здесь и на предыдущем шаге',
              )
            : !c2
              ? tr(
                  'Вернись на шаг назад и подтверди согласие',
                  'Вернитесь на шаг назад и подтвердите согласие',
                )
              : tr('Отметь согласие выше', 'Отметьте согласие выше')}
        </div>
      )}
    </div>
  );
}
