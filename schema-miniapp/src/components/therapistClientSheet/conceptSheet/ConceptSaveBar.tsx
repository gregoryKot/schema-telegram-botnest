import { SaveStatusLine } from '../../../../../shared/src/therapy/SaveStatusLine';
import type { SaveStatus } from '../../../../../shared/src/therapy/SaveStatusLine';
import { cm } from '../../../sections/schemas/utils';
import type { ClientDetail } from '../types';

// Низ листа концептуализации: кнопка сохранения + строка статуса (issue #879,
// шаг A). Кнопка — одно главное действие («Сохранить концептуализацию» при
// правках, иначе неактивная «Сохранено»); состояние — «Сохраняю…», «✓ Сохранено
// в ЧЧ:ММ», «Не сохранилось» + «Повторить» — рисует общий SaveStatusLine, тот
// же, что на вкладке сайта и на холсте карты режимов. Повтор зовёт тот же
// saveConcept: после ошибки лист остаётся «грязным».

export function conceptSaveStatus(d: {
  conceptSaving: boolean;
  conceptError: string;
  conceptDirty: boolean;
  hasConcept: boolean;
}): SaveStatus {
  if (d.conceptSaving) return 'saving';
  if (d.conceptError) return 'error';
  if (d.conceptDirty) return 'pending';
  return d.hasConcept ? 'saved' : 'idle';
}

export function ConceptSaveBar({ detail }: { detail: ClientDetail }) {
  const { concept, conceptDirty, conceptSaving, conceptError, saveConcept } =
    detail;
  const status = conceptSaveStatus({
    conceptSaving,
    conceptError,
    conceptDirty,
    hasConcept: Boolean(concept),
  });
  return (
    <>
      <button
        onClick={saveConcept}
        disabled={conceptSaving || !conceptDirty}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 'var(--r-14)',
          border: 'none',
          background: conceptDirty
            ? `linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, transparent), ${cm('var(--accent-blue)', 20)})`
            : 'rgba(var(--fg-rgb),0.05)',
          color: conceptDirty ? 'var(--text)' : 'rgba(var(--fg-rgb),0.25)',
          fontSize: 14,
          fontWeight: 600,
          cursor: conceptDirty ? 'pointer' : 'default',
          opacity: conceptSaving ? 0.6 : 1,
        }}
      >
        {conceptDirty
          ? 'Сохранить концептуализацию'
          : concept
            ? 'Сохранено'
            : 'Нет изменений'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
        <SaveStatusLine
          status={status}
          savedAt={concept?.updatedAt}
          onRetry={saveConcept}
        />
      </div>
    </>
  );
}
