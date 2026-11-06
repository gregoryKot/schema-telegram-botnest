import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { TabTitle } from '../TabTitle';
import { ConceptViewSwitch, type ConceptView } from '../../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { SaveStatusLine } from '../../../../../shared/src/therapy/SaveStatusLine';
import { actionStatusText, type GraphActions } from './conceptHeadText';
import { ConceptMoreMenu } from './ConceptMoreMenu';
import { ConceptBriefButton } from './ConceptBriefButton';
import { ConceptShareRow } from './ConceptShareRow';

// Шапка вкладки «Концептуализация» (#879, тест с терапевтом): в ней только переключатель «Схема · Поля» и статус
// сохранения; экспорт, картинка, лист на весь экран и холст — в одном меню «⋯» (пять кнопок читались как панель
// инструментов, и терапевт не находил главного). Меню закрывается по выбору пункта — занятость и отказ строкой под
// шапкой (ActionStatus). Заголовок и «Ещё» — на ≥768 (телефон прячет CSS); статус, сегмент, «Главное» и «⋯» — группа
// tcp-head-actions. «Главное» (2026-11) — своя кнопка: самое важное на одном экране, главный путь терапевта перед сессией.
// Под шапкой — строка «Показать клиенту» (ConceptShareRow): видна в обоих видах, не теснит кнопки шапки.
export interface ConceptTabHeadProps {
  detail: ClientDetail;
  view: ConceptView;
  onView: (v: ConceptView) => void;
  /** Есть только в виде «Схема»; ClientConceptGraph добавляет сам. */
  graph?: GraphActions;
}

export function ConceptTabHead({ detail, view, onView, graph }: ConceptTabHeadProps) {
  const { saveStatus, savedAt, retrySave, conceptError, exportCopied, exportEmpty, handleExport } = detail;
  return (
    <>
      <div className="tcp-head">
        <TabTitle title="Концептуализация" motif="layers" className="tcp-head-title"><div className="ds-sub">Схема-карта, цели терапии и связь с детским опытом</div></TabTitle>
        <div className="tcp-head-actions">
          <SaveStatusLine className="tcp-save" status={saveStatus} savedAt={savedAt} onRetry={retrySave} errorText={conceptError || undefined} align="right" />
          <ConceptViewSwitch view={view} onChange={onView} />
          <ConceptBriefButton detail={detail} />
          <ConceptMoreMenu onExport={handleExport} exportEmpty={exportEmpty} graph={graph} />
        </div>
      </div>
      <ActionStatus graph={graph} exportCopied={exportCopied} />
      <ConceptShareRow key={String(detail.selectedClient?.telegramId)} detail={detail} />
    </>
  );
}

function ActionStatus({ graph, exportCopied }: { graph?: GraphActions; exportCopied: boolean }) {
  const tr = useTr();
  const s = actionStatusText(graph, exportCopied, tr);
  if (!s) return null;
  return (
    <div role={s.err ? 'alert' : 'status'} className={`tcp-status${s.err ? ' is-err' : ''}`}>{s.text}</div>
  );
}
