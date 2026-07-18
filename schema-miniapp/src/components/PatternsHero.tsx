// Hero вкладки «Схемы» (волна 2 нейродизайна, правило «онбординг и
// очевидность»: одно главное действие, «откуда это и зачем» — до действия).
// Новичок: одна крупная CTA «Узнать свои схемы» + два тихих входа.
// Опытный: сводка недели «Чаще всего звучит» из дневника схем.
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { ToolRow } from './ToolRow';
import { HeroCta } from './HeroCta';
import { WeekTopCard } from './WeekTopCard';
import { WeekTopSummary } from '../utils/patternsSummary';

interface Props {
  hasSchemas: boolean;
  summary: WeekTopSummary | null;
  /** Отвеченных вопросов незаконченного теста (null — тест не начат). */
  progressAnswered?: number | null;
  onStartTest: () => void;
  onOpenLibrary: () => void;
  onPickManually: () => void;
  onOpenSchemaDetail: (id: string) => void;
  onOpenDiaries?: () => void;
}

export function PatternsHero({
  hasSchemas,
  summary,
  progressAnswered,
  onStartTest,
  onOpenLibrary,
  onPickManually,
  onOpenSchemaDetail,
  onOpenDiaries,
}: Props) {
  const tr = useTr();

  if (!hasSchemas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <HeroCta
          label="Первый шаг"
          chip="⏱ ≈10 мин"
          title="Узнать свои схемы"
          sub={tr(
            'Схемы — привычные реакции родом из детства. Тест покажет, какие включаются у тебя чаще всего.',
            'Схемы — привычные реакции родом из детства. Тест покажет, какие включаются у вас чаще всего.',
          )}
          buttonLabel={
            progressAnswered != null
              ? `Продолжить тест (${progressAnswered} из 116)`
              : 'Начать тест'
          }
          onClick={onStartTest}
        />
        <ToolRow
          emoji="📖"
          label="Что такое схемы и режимы"
          sub="короткое знакомство с картой"
          tint="var(--accent-blue)"
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          emoji="✍️"
          label="Собрать вручную"
          sub={tr('если уже знаешь свои схемы', 'если уже знаете свои схемы')}
          tint="var(--accent-green)"
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }

  if (summary) {
    const domain = SCHEMA_DOMAINS.find((d) =>
      d.schemas.some((s) => s.id === summary.id),
    );
    const schema = domain?.schemas.find((s) => s.id === summary.id);
    if (!schema || !domain) return null;
    return (
      <WeekTopCard
        label="Чаще всего звучит"
        color={domain.color}
        title={schema.name.split(' / ')[0]}
        sub={`${summary.days} из ${summary.windowDays} дней — по записям дневника. Это не приговор — просто то, за чем стоит понаблюдать.`}
        onClick={() => onOpenSchemaDetail(summary.id)}
      />
    );
  }

  if (onOpenDiaries) {
    return (
      <ToolRow
        emoji="📔"
        label="Картина недели появится из дневника"
        sub={tr(
          'замечай моменты, когда схема включилась',
          'замечайте моменты, когда схема включилась',
        )}
        tint="var(--accent-indigo)"
        onClick={onOpenDiaries}
      />
    );
  }
  return null;
}
