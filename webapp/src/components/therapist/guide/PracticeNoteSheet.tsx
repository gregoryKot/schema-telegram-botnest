import type { PracticeNote } from '../../../../../shared/src/schemaTherapy/guide';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { GuideSources } from './GuideSection';
import { GUIDE_COLUMN, guideColumnStyle, guideTextStyle } from './guideStyles';

/**
 * Лист раздела «Для терапевта» «Справочника» (#995, шаг 4): абзацы и
 * источники. Оболочка и колонка чтения — те же, что у листов режима, схемы и
 * техники (ConceptFullscreenSheet: «Назад» браузера закрывает лист).
 */
export function PracticeNoteSheet({ note, onClose }: { note: PracticeNote; onClose: () => void }) {
  return (
    <ConceptFullscreenSheet title={note.title} column={GUIDE_COLUMN} closeLabel="Закрыть" onClose={onClose}>
      <div style={guideColumnStyle}>
        {note.paragraphs.map((p, i) => <p key={i} style={guideTextStyle}>{p}</p>)}
        <GuideSources text={note.sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}
