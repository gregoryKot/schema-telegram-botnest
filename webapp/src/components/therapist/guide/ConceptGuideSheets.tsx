import { useTr } from '../../../utils/addressForm';
import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { useModeGuide, type ConceptGuideActions } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { useGuide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { ModeGuideSheet } from './ModeGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';

/** Какие листы подсказок открыты: режим (лист режима) и поверх него — техника. */
export interface GuideOpen { modeId: string | null; technique: TechniqueId | null }

/**
 * Листы подсказок терапевту (#995): лист режима и лист техники. Техника
 * рисуется позже режима — на том же слое она лежит поверх него; открытая с
 * плашки, без режима, — одна. Состояние и события — useConceptGuide. Тексты
 * — отдельный чанк (guideLoader): этот компонент стоит рядом со схемой случая
 * с её открытия, и загрузка начинается раньше первого тапа по фигуре.
 */
export function ConceptGuideSheets({ open, actions, onCloseMode, onCloseTechnique }: {
  open: GuideOpen; actions: ConceptGuideActions; onCloseMode: () => void; onCloseTechnique: () => void;
}) {
  const tr = useTr();
  const texts = useGuide();
  const { modeId } = open;
  const view = useModeGuide(modeId ?? '');
  const technique = texts && open.technique ? texts.techniqueGuide(tr, open.technique) : null;
  const assign = actions.onAssign;
  return (
    <>
      {modeId && view && (
        <ModeGuideSheet
          modeName={getModeById(modeId)?.name ?? ''} view={view}
          onOpenTechnique={(id) => actions.onOpenTechnique(id, modeId)}
          onAssign={assign && ((item) => assign(item, modeId))}
          onClose={onCloseMode}
        />
      )}
      {technique && <TechniqueSheet technique={technique} onClose={onCloseTechnique} />}
    </>
  );
}
