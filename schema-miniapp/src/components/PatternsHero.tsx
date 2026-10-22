// Hero вкладки «Схемы» (волна 2 нейродизайна, правило «онбординг и
// очевидность»: одно главное действие, «откуда это и зачем» — до действия).
// Новичок: одна крупная CTA «Узнать свои схемы» + два тихих входа.
// Опытный: сводка недели «Чаще всего звучит» из дневника схем.
import { useTr } from '../utils/addressForm';
import { ToolRow } from './ToolRow';
import { HeroCta } from './HeroCta';
import { WeekTopCard } from './WeekTopCard';
import { WeekTopSummary } from '../../../shared/src/pattern/patternsSummary';
import {
  schemaIntro,
  weekTopText,
  diaryIntro,
} from '../../../shared/src/pattern/weekPatternText';

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
    const intro = schemaIntro(tr);
    return (
      <div className="u-col12">
        <HeroCta
          label={intro.label}
          chip={intro.chip}
          title={intro.title}
          sub={intro.sub}
          buttonLabel={
            progressAnswered != null
              ? `Продолжить тест (${progressAnswered} из 116)`
              : 'Начать тест'
          }
          onClick={onStartTest}
        />
        <ToolRow
          label="Что такое схемы и режимы"
          sub="короткое знакомство с картой"
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          label="Собрать вручную"
          sub={tr('если уже знаешь свои схемы', 'если уже знаете свои схемы')}
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }

  if (summary) {
    const text = weekTopText('schema', summary);
    if (!text) return null;
    return (
      <WeekTopCard
        label={text.label}
        color={text.color}
        title={text.title}
        sub={text.sub}
        onClick={() => onOpenSchemaDetail(summary.id)}
      />
    );
  }

  if (onOpenDiaries) {
    return (
      <ToolRow
        label={diaryIntro(tr).title}
        sub={tr(
          'замечай моменты, когда схема включилась',
          'замечайте моменты, когда схема включилась',
        )}
        onClick={onOpenDiaries}
      />
    );
  }
  return null;
}
