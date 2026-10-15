import { useRef } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ConceptGraph } from '../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import { conceptGraphHandlers } from '../../../../shared/src/therapy/conceptGraph/conceptGraphHandlers';
import { conceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import type { ClientDetail } from './clientSheetTypes';
import { useConceptGraphImage } from './useConceptGraphImage';

// Вид «Схема» вкладки концептуализации: схема случая по модели режимов.
// Правки идут через те же patchConcept/toggleModeId, что и вид «Поля», —
// автосохранение и экспорт остаются одни на оба вида. «Скачать картинкой»
// только здесь: мини-апп файл из WebView Telegram не скачивает.
export function ClientConceptGraph({ detail }: { detail: ClientDetail }) {
  const tr = useTr();
  const { concept, localConcept, activeSchemaIds, toggleModeId, patchConcept } =
    detail;
  const graphRef = useRef<HTMLDivElement>(null);
  const image = useConceptGraphImage(graphRef);
  const source = conceptGraphSource({ ...concept, ...localConcept });
  const { onChangeLink, onAddSchema } = conceptGraphHandlers({
    modeLinks: source.modeLinks,
    schemaIds: activeSchemaIds,
    patch: patchConcept,
  });

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          marginBottom: 'var(--space-12)',
        }}
      >
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          onClick={image.download}
          disabled={image.busy}
        >
          {image.busy ? 'Готовлю картинку…' : '↓ Скачать картинкой'}
        </button>
        {image.failed && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--err)' }}>
            {tr(
              'Не удалось сохранить картинку. Попробуй ещё раз.',
              'Не удалось сохранить картинку. Попробуйте ещё раз.',
            )}
          </span>
        )}
      </div>
      <div ref={graphRef} style={{ padding: 'var(--space-8)' }}>
        <ConceptGraph
          source={source}
          onToggleMode={toggleModeId}
          onChangeLink={onChangeLink}
          onAddSchema={onAddSchema}
          track={api.trackEvent}
        />
      </div>
    </div>
  );
}
