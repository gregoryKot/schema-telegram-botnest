import type { PracticeNote } from '../../../../../shared/src/schemaTherapy/guide';
import { GuideSignArt } from '../../art/GuideSigns';
import { practiceNoteSign } from '../../art/guideSignsModel';
import { GuideSection } from './GuideSection';
import { GuidePage, GuidePoints, GuideVoice } from './GuideSheet';

/**
 * Лист раздела «Для терапевта» «Справочника» (#995, шаг 4; живой язык 2026-11): каркас
 * GuidePage, общий с листами режима, схемы и техники, — в шапке «Для терапевта», герой с
 * сутью (`summary`) и знаком раздела (practiceNoteSign), «Что делать» пунктами, «Как это
 * звучит», под «Подробнее» — пункты `more`, мелко источники. Раздел без своего знака — без
 * картинки, а не с чужой.
 */
export function PracticeNoteSheet({ note, onClose }: { note: PracticeNote; onClose: () => void }) {
  const sign = practiceNoteSign(note.id);
  const points = note.points.filter((p) => p.trim());
  return (
    <GuidePage
      label="Для терапевта" title={note.title} lede={note.summary} onClose={onClose}
      art={sign && <GuideSignArt sign={sign} size="hero" />}
      more={note.more} sources={note.sources}
    >
      {points.length > 0 && (
        <GuideSection title="Что делать">
          <GuidePoints items={points} />
        </GuideSection>
      )}
      <GuideVoice lines={note.voice} />
    </GuidePage>
  );
}
