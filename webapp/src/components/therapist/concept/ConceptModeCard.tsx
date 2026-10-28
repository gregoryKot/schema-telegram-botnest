import { ConceptModePicker } from '../../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { ModeSchemasList } from '../../../../../shared/src/therapy/conceptGraph/ModeSchemasList';
import type { ClientDetail } from '../clientSheetTypes';

// Карточка «Карта режимов» вида «Поля»: чипы режимов, под ними — схемы,
// привязанные к режимам в modeLinks (черновик сильнее сервера, issue #879).
// Связи здесь только читаются; редактируются они в виде «Схема», куда ведёт
// onGoToGraph (правило «одна механика — один компонент»).
export function ConceptModeCard({ detail, onGoToGraph }: { detail: ClientDetail; onGoToGraph?: () => void }) {
  const { activeModeIds, toggleModeId, localConcept, concept } = detail;
  return (
    <section className="ds-card">
      <div className="ds-head-row" style={{ marginBottom: 16 }}>
        <h3 className="ds-h3">Карта режимов</h3>
        <span className="ds-sub">{activeModeIds.length} в работе</span>
      </div>
      <ConceptModePicker activeModeIds={activeModeIds} onToggle={toggleModeId} />
      <ModeSchemasList
        activeModeIds={activeModeIds}
        modeLinks={localConcept.modeLinks ?? concept?.modeLinks}
        onGoToGraph={onGoToGraph}
      />
    </section>
  );
}
