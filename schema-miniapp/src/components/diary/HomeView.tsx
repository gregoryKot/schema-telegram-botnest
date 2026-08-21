import { DiaryType } from '../../types';
import { useSafeTop } from '../../utils/safezone';
import { haptic } from '../../haptic';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { DiaryHubIntro } from './DiaryHubIntro';
import { CapsLabel, DiaryPanel, DiaryRow } from './diaryUi';
import { diaryRowMeta } from './diaryMeta';
import { plural } from '../../sections/today/helpers';
import { fmtAgo } from '../../utils/format';

interface Props {
  schemaDiaryCount: number;
  modeDiaryCount: number;
  gratitudeDiaryCount: number;
  lastSchemaDiaryDate?: string;
  lastModeDiaryDate?: string;
  lastGratitudeDiaryDate?: string;
  streak?: number;
  lastNeedsDate?: string;
  onOpen: (type: DiaryType) => void;
  onOpenTracker?: () => void;
  onClose?: () => void;
}

/** Чип серии: только реальное число из профиля, ноль — не показываем. */
function StreakChip({ streak }: { streak: number }) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 14px',
        borderRadius: 14,
        background: 'var(--accent-bg)',
        border: '1px solid rgba(154,91,62,0.28)',
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>
        {streak}
      </span>
      <span className="d-caps" style={{ color: 'var(--accent)' }}>
        {plural(streak, 'день', 'дня', 'дней')}
      </span>
    </div>
  );
}

export function HomeView({
  schemaDiaryCount,
  modeDiaryCount,
  gratitudeDiaryCount,
  lastSchemaDiaryDate,
  lastModeDiaryDate,
  lastGratitudeDiaryDate,
  streak,
  lastNeedsDate,
  onOpen,
  onOpenTracker,
  onClose,
}: Props) {
  const tr = useTr();
  const safeTop = useSafeTop();
  const empty = schemaDiaryCount + modeDiaryCount + gratitudeDiaryCount === 0;

  const diaries = [
    {
      type: 'schema' as DiaryType,
      title: 'Дневник схем',
      desc: tr(
        'Что-то задело — запиши ситуацию, чувства, мысли',
        'Что-то задело — запишите ситуацию, чувства, мысли',
      ),
      meta: diaryRowMeta(schemaDiaryCount, lastSchemaDiaryDate),
    },
    {
      type: 'mode' as DiaryType,
      title: 'Дневник режимов',
      desc: tr(
        'Знакомое состояние взяло верх — запиши, кто внутри',
        'Знакомое состояние взяло верх — запишите, кто внутри',
      ),
      meta: diaryRowMeta(modeDiaryCount, lastModeDiaryDate),
    },
    {
      type: 'gratitude' as DiaryType,
      title: 'Дневник благодарности',
      desc: 'Три вещи, за которые можно сказать спасибо сегодня',
      meta: diaryRowMeta(gratitudeDiaryCount, lastGratitudeDiaryDate),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: `${safeTop + 16}px 16px 32px` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 22,
        }}
      >
        {onClose && (
          <span
            {...pressable(onClose)}
            aria-label="Назад"
            style={{
              fontSize: 26,
              lineHeight: 1,
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px 8px 12px 0',
            }}
          >
            ‹
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="d-display" style={{ fontSize: 27, margin: 0 }}>
            Мои дневники
          </h1>
          <div
            style={{
              fontSize: 14,
              color: 'var(--muted)',
              marginTop: 6,
              lineHeight: 1.45,
            }}
          >
            Место для честного разговора с собой
          </div>
        </div>
        {streak != null && streak > 0 && <StreakChip streak={streak} />}
      </div>

      <DiaryHubIntro empty={empty} />

      <CapsLabel>Записать момент</CapsLabel>
      <DiaryPanel style={{ marginBottom: 26 }}>
        {diaries.map((d) => (
          <DiaryRow
            key={d.type}
            title={d.title}
            desc={d.desc}
            meta={d.meta}
            onClick={() => {
              haptic.tap();
              onOpen(d.type);
            }}
          />
        ))}
      </DiaryPanel>

      {onOpenTracker && (
        <>
          <CapsLabel>Оценить день</CapsLabel>
          <DiaryPanel>
            <DiaryRow
              title="Трекер потребностей"
              desc="Пять базовых потребностей — что сегодня питает, что истощает"
              meta={
                lastNeedsDate
                  ? `Последняя отметка · ${fmtAgo(lastNeedsDate)}`
                  : 'Пока пусто'
              }
              onClick={() => {
                haptic.tap();
                onOpenTracker();
              }}
            />
          </DiaryPanel>
        </>
      )}
    </div>
  );
}
