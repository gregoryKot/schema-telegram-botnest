import { useMemo, useState } from 'react';
import { api } from '../../api';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { useGuide, type Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { GuideReferenceList } from './GuideReferenceList';
import { GuideSchemaTable, SchemaViewSwitch, type SchemaView } from './GuideSchemaTable';
import { FadeSeg } from '../../components/FadeSeg';
import { REFERENCE_TABS, buildReference, referenceLayout, type ReferenceTab } from './guideReferenceModel';
import { searchReference } from './guideReferenceSearch';
import { buildReferenceBody } from './guideReferenceBody';
import { buildAnswerSources, referenceAnswer } from './guideReferenceAnswer';
import { GuideAnswerCard } from './GuideAnswerCard';
import { GuideReferenceSkeleton } from './GuideReferenceSkeleton';
import { useRouteGuideSheet } from './guideSheetRoute';
import { useReferenceSheets } from './useReferenceSheets';

/**
 * Тело «Справочника»: пока чанк текстов грузится — силуэт списка, не
 * загрузился — лист соломы (PaperAlert) и «Повторить» (родитель монтирует тело заново).
 */
export function GuideReference({ onRetry }: { onRetry: () => void }) {
  const texts = useGuide();
  if (texts === undefined) return <GuideReferenceSkeleton />;
  if (texts === null) {
    return <PaperAlert sign="layers" title="Справочник не загрузился. Обычно помогает ещё одна попытка" onRetry={onRetry} />;
  }
  return <GuideReferenceLoaded texts={texts} />;
}

/**
 * Поиск по названиям и текстам листов, переключатель разделов (тот же ds-seg, что у списка
 * клиентов) и список. Пустой раздел в переключатель не попадает. Листы — useReferenceSheets.
 */
function GuideReferenceLoaded({ texts }: { texts: Guide }) {
  const form = useAddressForm();
  const tr = useMemo(() => (ty: string, vy: string) => pickForm(form, ty, vy), [form]);
  const ref = useMemo(() => buildReference(texts, tr), [texts, tr]);
  const schemaGuides = useMemo(() => texts.buildSchemaDomainGuides(tr), [texts, tr]);
  const [tab, setTab] = useState<ReferenceTab>('modes');
  const [query, setQuery] = useState('');
  const [schemaView, setSchemaView] = useState<SchemaView>('list');
  const { open, sheets, markCoping } = useReferenceSheets(texts, tr);
  const tabs = REFERENCE_TABS.filter((t) => ref[t.id].length > 0);
  const body = useMemo(() => buildReferenceBody(texts, tr), [texts, tr]);
  const found = useMemo(() => searchReference(ref, query, body), [ref, query, body]);
  const sources = useMemo(() => buildAnswerSources(texts, tr), [texts, tr]);
  const answer = useMemo(() => referenceAnswer(ref, sources, query), [ref, sources, query]);
  const searching = query.trim() !== '';
  const schemaTable = tab === 'schemas' && !searching && schemaView === 'table';
  const pickSchemaView = (v: SchemaView) => {
    if (v === 'table' && schemaView !== 'table') api.trackEvent('cabinet_guide_table_open');
    setSchemaView(v);
  };
  useRouteGuideSheet(ref, open); // лист из общего поиска (⌘K): состояние маршрута → open
  return (
    <div className="gr-column">
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80}
        placeholder="Найти по названию или тексту" aria-label="Найти в справочнике" className="ds-input ds-input--search"
      />
      {!searching && (
        <div className="gr-bar">
          <FadeSeg className="gr-seg" role="tablist" label="Разделы справочника" watch={tab}>
            {tabs.map((t) => (
              <button
                key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                className={`ds-seg-btn${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </FadeSeg>
          {tab === 'schemas' && <SchemaViewSwitch view={schemaView} onPick={pickSchemaView} />}
        </div>
      )}
      {answer && <GuideAnswerCard answer={answer} onOpen={open} />}
      {schemaTable && <GuideSchemaTable groups={ref.schemas} guides={schemaGuides} onOpen={open} onMark={markCoping} />}
      {!schemaTable && (searching && found.length === 0
        ? <p className="ds-empty">Ничего не нашлось</p>
        : <GuideReferenceList groups={searching ? found : ref[tab]} layout={referenceLayout(tab, searching)} onOpen={open} />)}
      {sheets}
    </div>
  );
}
