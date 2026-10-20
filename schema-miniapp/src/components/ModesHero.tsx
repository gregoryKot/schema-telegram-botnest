// Hero вкладки «Режимы» (волна 2 нейродизайна, правило «онбординг и
// очевидность»). Новичку — одно очевидное знакомство: Требовательный Критик,
// самый узнаваемый режим. Опытному — сводка недели «Чаще всего включается»
// из дневника режимов.
import { useTr } from '../utils/addressForm';
import { ToolRow } from './ToolRow';
import { HeroCta } from './HeroCta';
import { WeekTopCard } from './WeekTopCard';
import { WeekTopSummary } from '../../../shared/src/pattern/patternsSummary';
import { INTRO_MODE_ID } from '../../../shared/src/pattern/weekPatternText';
import { modesHeroModel } from '../../../shared/src/pattern/modesHeroModel';

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
  // Какое состояние и какие слова — решает общая модель (shared), здесь только вёрстка.
  const m = modesHeroModel(tr, {
    hasModes,
    summary,
    canOpenDiary: !!onOpenDiaries,
  });

  if (m.kind === 'intro') {
    return (
      <div className="u-col12">
        <HeroCta
          label={m.intro.label}
          chip={m.intro.chip}
          title={m.intro.title}
          sub={m.intro.sub}
          buttonLabel={m.buttonLabel}
          onClick={onMeetCritic}
        />
        <ToolRow
          label={m.library.label}
          sub={m.library.sub}
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          label={m.manual.label}
          sub={m.manual.sub}
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }
  if (m.kind === 'week') {
    return (
      <WeekTopCard
        label={m.text.label}
        color={m.text.color}
        title={m.text.title}
        sub={m.text.sub}
        onClick={() => onOpenModeDetail(m.id)}
      />
    );
  }
  if (m.kind === 'diary' && onOpenDiaries)
    return (
      <ToolRow label={m.row.label} sub={m.row.sub} onClick={onOpenDiaries} />
    );
  return null;
}
