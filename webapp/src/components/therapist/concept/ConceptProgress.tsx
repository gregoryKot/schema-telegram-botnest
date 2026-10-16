import { CONCEPT_SECTIONS, sectionAnchor, sectionNumber, filledSections, type ConceptValues } from './conceptSections';

// «Заполнено N из M», сегментный прогресс и чипы-якоря разделов.
export function ConceptProgress({ values }: { values: ConceptValues }) {
  const filled = filledSections(values);
  const count = filled.filter(Boolean).length;
  const jump = (key: string) =>
    document.getElementById(sectionAnchor(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="tcp-progress">
      <div className="ds-label">Заполнено</div>
      <div className="tcp-count">
        {count} <span>из {CONCEPT_SECTIONS.length}</span>
      </div>
      <div className="tcp-bars" aria-hidden="true">
        {filled.map((f, i) => (
          <i key={i} className={f ? 'is-on' : undefined} />
        ))}
      </div>
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
