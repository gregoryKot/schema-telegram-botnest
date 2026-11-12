import { useMemo, useState } from 'react';
import { api } from '../../api';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { useGuide, type Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { useConceptGuide, type GuideOpenTrack } from '../../components/therapist/guide/useConceptGuide';
import { PracticeNoteSheet } from '../../components/therapist/guide/PracticeNoteSheet';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { Skeleton, SkeletonList } from '../../components/Skeleton';
import { GuideReferenceList } from './GuideReferenceList';
import { FadeSeg } from '../../components/FadeSeg';
import { REFERENCE_TABS, buildReference, referenceLayout, type ReferenceItem, type ReferenceTab } from './guideReferenceModel';
import { searchReference } from './guideReferenceSearch';

// Открытия листов из «Справочника» — свои события, не concept_guide_* схемы случая.
const REFERENCE_TRACK: GuideOpenTrack = {
  mode: () => api.trackEvent('cabinet_guide_mode_open'),
  schema: () => api.trackEvent('cabinet_guide_schema_open'),
  technique: () => api.trackEvent('cabinet_guide_technique_open'),
};

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
 * Поиск по названиям, переключатель разделов (тот же ds-seg, что у списка
 * клиентов) и список. Пустой раздел в переключатель не попадает. Листы
 * режима, схемы и техники — те же, что в схеме случая (useConceptGuide), без
 * клиента: без «Дать заданием», отметок и истории.
 */
function GuideReferenceLoaded({ texts }: { texts: Guide }) {
  const form = useAddressForm();
  const tr = useMemo(() => (ty: string, vy: string) => pickForm(form, ty, vy), [form]);
  const ref = useMemo(() => buildReference(texts, tr), [texts, tr]);
  const [tab, setTab] = useState<ReferenceTab>('modes');
  const [query, setQuery] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const guide = useConceptGuide({ track: REFERENCE_TRACK });
  const tabs = REFERENCE_TABS.filter((t) => ref[t.id].length > 0);
  const found = searchReference(ref, query);
  const searching = query.trim() !== '';
  const note = noteId ? texts.practiceNotes(tr).find((n) => n.id === noteId) : undefined;
  const open = (item: ReferenceItem) => {
    if (item.kind === 'mode') guide.actions.onOpenMode(item.id);
    else if (item.kind === 'schema') guide.actions.onOpenSchema(item.id);
    else if (item.kind === 'technique') guide.actions.onOpenTechnique(item.id);
    else {
      api.trackEvent('cabinet_guide_note_open');
      setNoteId(item.id);
    }
  };
  return (
    <div className="gr-column">
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80}
        placeholder="Найти по названию" aria-label="Найти в справочнике" className="ds-input ds-input--search"
      />
      {!searching && (
        <FadeSeg className="u-self-start gr-seg" role="tablist" label="Разделы справочника" watch={tab}>
          {tabs.map((t) => (
            <button
              key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`ds-seg-btn${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </FadeSeg>
      )}
      {searching && found.length === 0
        ? <p className="ds-empty">Ничего не нашлось</p>
        : <GuideReferenceList groups={searching ? found : ref[tab]} layout={referenceLayout(tab, searching)} onOpen={open} />}
      {guide.sheets}
      {note && <PracticeNoteSheet note={note} onClose={() => setNoteId(null)} />}
    </div>
  );
}

/** Силуэт: строка поиска, переключатель и группы строк — в те же колонки, что группы режимов. */
function GuideReferenceSkeleton() {
  return (
    <div aria-hidden className="gr-column">
      <Skeleton height={44} radius={22} />
      <Skeleton width={300} height={34} radius={20} style={{ maxWidth: '100%' }} />
      <div className="gr-wrap">
        <div className="gr-list gr-list--groups">
          {[4, 3].map((rows) => (
            <div key={rows} className="gr-skel-group">
              <Skeleton width="40%" height={24} />
              <SkeletonList rows={rows} height={48} radius={12} gap={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
