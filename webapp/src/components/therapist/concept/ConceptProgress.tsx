import { CONCEPT_SECTIONS, sectionAnchor, sectionNumber, filledSections, type ConceptValues } from './conceptSections';

// «Заполнено N из M» одной мелкой строкой и чипы-якоря разделов рядом.
export function ConceptProgress({ values }: { values: ConceptValues }) {
  const count = filledSections(values).filter(Boolean).length;
  const jump = (key: string) =>
    document.getElementById(sectionAnchor(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="tcp-progress">
      <span className="tcp-fill">Заполнено {count} из {CONCEPT_SECTIONS.length}</span>
      <div className="tcp-anchors">
        {CONCEPT_SECTIONS.map((s, i) => (
          <button key={s.key} type="button" className="tcp-anchor" onClick={() => jump(s.key)}>
            <span>{sectionNumber(i)}</span>
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
