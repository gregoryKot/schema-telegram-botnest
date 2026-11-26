import { CONCEPT_SECTIONS, sectionAnchor, sectionNumber, filledSections, type ConceptValues } from './conceptSections';
import { SignArt } from '../../art/SignArt';

// «Заполнено N из M» одной мелкой строкой и тихие чипы-якоря разделов рядом; заполненный — бумага с галочкой.
export function ConceptProgress({ values }: { values: ConceptValues }) {
  const filled = filledSections(values);
  const jump = (key: string) => document.getElementById(sectionAnchor(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="tcp-progress">
      <span className="tcp-fill">Заполнено {filled.filter(Boolean).length} из {CONCEPT_SECTIONS.length}</span>
      <div className="tcp-anchors">
        {CONCEPT_SECTIONS.map((s, i) => (
          <button key={s.key} type="button" className={`tcp-anchor${filled[i] ? ' is-filled' : ''}`} data-filled={filled[i] || undefined} onClick={() => jump(s.key)}>
            {filled[i] ? <SignArt sign="check" size="nav" /> : <span>{sectionNumber(i)}</span>}
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
