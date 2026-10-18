import { Skeleton } from '../Skeleton';
import { DiaryPanel } from './diaryUi';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import type { GratitudeLoadStatus } from '../../../../shared/src/diary/useGratitudeItems';

const PLACEHOLDERS = [
  'Что-то хорошее, что произошло сегодня...',
  'Кто-то, кто помог или поддержал...',
  'Момент, который хочется запомнить...',
  'Что-то простое, что согрело...',
  'Что-то, что обычно ускользает...',
];

/** Силуэт трёх строк, пока грузится сохранённый день, и ошибка с «Повторить»
 * при сбое. Инцидент 2026-10-18: в пустую форму печатать нельзя, а сохранять
 * пустую поверх возможной записи — значит затереть её. */
export function GratitudeLoadState({
  status,
  onRetry,
}: {
  status: GratitudeLoadStatus;
  onRetry: () => void;
}) {
  if (status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Загружаю сегодняшние записи">
        <DiaryPanel>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: '16px 14px',
                borderTop: i === 0 ? undefined : '1px solid var(--line)',
              }}
            >
              <Skeleton h={48} radius={10} />
            </div>
          ))}
        </DiaryPanel>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" style={{ fontSize: 14, lineHeight: 1.5 }}>
        <div style={{ color: 'var(--accent-red)', marginBottom: 8 }}>
          Не получилось загрузить записи за сегодня. Пока они не загрузились,
          сохранять нельзя: новая запись заменила бы прежние.
        </div>
        <button
          onClick={onRetry}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 2px',
            minHeight: 48,
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }
  return null;
}

export function GratitudeItemsPanel({
  items,
  onChange,
}: {
  items: string[];
  onChange: (i: number, v: string) => void;
}) {
  return (
    <DiaryPanel>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '4px 14px',
            borderTop: i === 0 ? undefined : '1px solid var(--line)',
          }}
        >
          <LimitedTextarea
            max={DIARY_FIELD_MAX}
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={
              PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]
            }
            rows={2}
            aria-label={`Благодарность ${i + 1}`}
            style={{
              width: '100%',
              minHeight: 48,
              background: 'none',
              border: 'none',
              padding: '12px 0',
              color: 'var(--text)',
              fontSize: 15,
              lineHeight: 1.5,
              outline: 'none',
              resize: 'none',
            }}
          />
        </div>
      ))}
    </DiaryPanel>
  );
}
