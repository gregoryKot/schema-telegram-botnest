import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTr } from '../../utils/addressForm';
import type { WeekTopSummary } from '../../../../shared/src/pattern/patternsSummary';
import { modesHeroModel, type ModesHeroRow } from '../../../../shared/src/pattern/modesHeroModel';
import { Pebbles } from '../../components/art/PaperArt';
import { glue } from '../../../../shared/src/utils/typo';
import { WeekPatternCard } from './WeekPatternCard';
import { PatternsIntro } from './PatternsIntro';
import { PatternsHeroSkeleton } from './PatternsTopCards';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';

interface Props {
  /** Профиль или записи дневника ещё грузятся — ничего не рисуем (не выдумываем состояние). */
  ready: boolean;
  hasModes: boolean;
  /** Режим недели по дневнику режимов; null — записей за 7 дней нет. */
  summary: WeekTopSummary | null;
  onMeetCritic: () => void;
  onOpenLibrary: () => void;
  onPickManually: () => void;
  onOpenMode: (id: string) => void;
  /** Скрытие блока «Подсказка сверху» и долгое нажатие («Настроить экран»). */
  blocks: SiteScreenBlocks;
  /** «Чаще всего включается» на белом листе: под ним группа «Моих режимов» близкой бумаги (patternsTop). */
  white?: boolean;
}

/** Строки-входы под героем; знак — только там, где он свой (дневник — камешки). Под вводной режимов строки
 *  без знака: Cluster стоял у героя и у обеих строк — один знак четыре раза на вкладке (ревью g5 r1). */
function ToolRows({ rows, art }: { rows: (ModesHeroRow & { onClick: () => void })[]; art?: ReactNode }) {
  return (
    <div className="ds-card ds-card--flush">
      {rows.map((r) => (
        <button key={r.label} type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={r.onClick}>
          {art && <span className="pp-row-art">{art}</span>}<span className="ds-list-body"><span className="ds-list-title">{glue(r.label)}</span><span className="ds-list-sub">{glue(r.sub)}</span></span>
          <span className="ds-chev" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/**
 * Верх вкладки «Режимы» (телефон): как в мини-аппе — новичку знакомство с Критиком
 * и два входа, опытному «Чаще всего включается», а без записей за неделю —
 * строка в дневник. Состояние и слова — shared/pattern/modesHeroModel.
 */
export function ModesTopCards({ ready, hasModes, summary, onMeetCritic, onOpenLibrary, onPickManually, onOpenMode, blocks, white }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  if (!ready) return blocks.isHidden('heroes') ? null : <PatternsHeroSkeleton />;
  const m = modesHeroModel(tr, { hasModes, summary, canOpenDiary: true });
  if (m.kind === 'none') return null;
  return (
    <ScreenBlock id="heroes" blocks={blocks} className="cs-hero-stack">
      {m.kind === 'intro' && (
        <>
          <PatternsIntro step="modes" testProgress={null} onAction={onMeetCritic} />
          <ToolRows rows={[{ ...m.library, onClick: onOpenLibrary }, { ...m.manual, onClick: onPickManually }]} />
        </>
      )}
      {m.kind === 'week' && summary && <WeekPatternCard top={{ kind: 'mode', ...summary }} onOpen={(_, id) => onOpenMode(id)} white={white} />}
      {m.kind === 'diary' && <ToolRows rows={[{ ...m.row, onClick: () => navigate('/diary') }]} art={<Pebbles size="row" />} />}
    </ScreenBlock>
  );
}
