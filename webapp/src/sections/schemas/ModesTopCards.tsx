import { useNavigate } from 'react-router-dom';
import { useTr } from '../../utils/addressForm';
import type { WeekTopSummary } from '../../../../shared/src/pattern/patternsSummary';
import { modesHeroModel, type ModesHeroRow } from '../../../../shared/src/pattern/modesHeroModel';
import { WeekPatternCard } from './WeekPatternCard';
import { PatternsIntro } from './PatternsIntro';
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
}

function ToolRows({ rows }: { rows: (ModesHeroRow & { onClick: () => void })[] }) {
  return (
    <div className="cs-tools">
      {rows.map((r) => (
        <button key={r.label} className="cs-row" onClick={r.onClick}>
          <span className="cs-row-text">
            <span className="cs-row-name">{r.label}</span>
            <span className="cs-row-sub">{r.sub}</span>
          </span>
          <span className="cs-fold-chev" aria-hidden>›</span>
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
export function ModesTopCards({ ready, hasModes, summary, onMeetCritic, onOpenLibrary, onPickManually, onOpenMode, blocks }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  if (!ready) return null;
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
      {m.kind === 'week' && summary && <WeekPatternCard top={{ kind: 'mode', ...summary }} onOpen={(_, id) => onOpenMode(id)} />}
      {m.kind === 'diary' && <ToolRows rows={[{ ...m.row, onClick: () => navigate('/diary') }]} />}
    </ScreenBlock>
  );
}
