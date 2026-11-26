import type { ReactNode } from 'react';
import { ConceptSkinContext } from '../../../../../shared/src/therapy/conceptGraph/conceptSkin';
import { ConceptPaperContext, type ConceptPaper } from '../../../../../shared/src/therapy/conceptGraph/conceptPaper';
import { SignArt } from '../../art/SignArt';
import { SignChip } from '../../paper/SignChip';
import { SignGroup } from '../../schemaSheets/SignGroup';
import { CONCEPT_SITE_SKIN } from './conceptSiteSkin';
import '../../../styles/therapist-concept.css'; // concept-graph.css (cg-*) подключается оттуда: часть раскроя — через один css (cssSplit.test)

// Вид концептуализации на сайте — одним провайдером на вкладку терапевта и на лист клиента «Схема случая»:
// классы ds-* (ConceptSkinContext) и детали живой бумаги (ConceptPaperContext) — знаки SignArt, чип SignChip,
// группа SignGroup. Те же детали, что у клиента в «Моих паттернах»: терапевт и клиент говорят одними знаками.
// Сцену пустой схемы даёт вкладка терапевта (у клиента пустого состояния с кнопкой нет).
const PAPER: Omit<ConceptPaper, 'emptyScene'> = {
  sign: (sign, size) => <SignArt sign={sign} size={size} />,
  Chip: SignChip,
  Group: SignGroup,
};

export function ConceptPaperProvider({ emptyScene, children }: { emptyScene?: ReactNode; children: ReactNode }) {
  return (
    <ConceptSkinContext.Provider value={CONCEPT_SITE_SKIN}>
      <ConceptPaperContext.Provider value={{ ...PAPER, emptyScene: emptyScene && <span className="cg-empty-scene">{emptyScene}</span> }}>
        {children}
      </ConceptPaperContext.Provider>
    </ConceptSkinContext.Provider>
  );
}
