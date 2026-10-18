// Hero вкладки «Режимы» (волна 2 нейродизайна, правило «онбординг и
// очевидность»). Новичку — одно очевидное знакомство: Требовательный Критик,
// самый узнаваемый режим. Опытному — сводка недели «Чаще всего включается»
// из дневника режимов.
import { useTr } from '../utils/addressForm';
import { ToolRow } from './ToolRow';
import { HeroCta } from './HeroCta';
import { WeekTopCard } from './WeekTopCard';
import { WeekTopSummary } from '../../../shared/src/pattern/patternsSummary';
import {
  INTRO_MODE_ID,
  modeIntro,
  weekTopText,
  diaryIntro,
} from '../../../shared/src/pattern/weekPatternText';

export { INTRO_MODE_ID };

interface Props {
  hasModes: boolean;
  summary: WeekTopSummary | null;
  onMeetCritic: () => void;
  onOpenLibrary: () => void;
  onPickManually: () => void;
  onOpenModeDetail: (id: string) => void;
  onOpenDiaries?: () => void;
}

export function ModesHero({
  hasModes,
  summary,
  onMeetCritic,
  onOpenLibrary,
  onPickManually,
  onOpenModeDetail,
  onOpenDiaries,
}: Props) {
  const tr = useTr();

  if (!hasModes) {
    const intro = modeIntro(tr);
    return (
      <div className="u-col12">
        <HeroCta
          label={intro.label}
          chip={intro.chip}
          title={intro.title}
          sub={intro.sub}
          buttonLabel="Познакомиться"
          onClick={onMeetCritic}
        />
        <ToolRow
          label="Что такое режимы"
          sub="части, которые включаются по очереди"
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          label="Отметить свои"
          sub={tr('если уже знаешь свои режимы', 'если уже знаете свои режимы')}
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }

  if (summary) {
    const text = weekTopText('mode', summary);
    if (!text) return null;
    return (
      <WeekTopCard
        label={text.label}
        color={text.color}
        title={text.title}
        sub={text.sub}
        onClick={() => onOpenModeDetail(summary.id)}
      />
    );
  }

  if (onOpenDiaries) {
    return (
      <ToolRow
        label={diaryIntro(tr).title}
        sub={tr(
          'замечай моменты, когда режим включился',
          'замечайте моменты, когда режим включился',
        )}
        onClick={onOpenDiaries}
      />
    );
  }
  return null;
}
