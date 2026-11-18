// Действия кабинета по состоянию маршрута: общий поиск (палитра ⌘K) ведёт в карточку клиента с
// { assignTask } — открыть лист «Новое задание», и к списку с { addClient } — открыть форму клиента.
// Исполняются один раз на переход (hooks/useRouteStateOnce.ts).
import { useState } from 'react';
import { customTaskText, type CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import { matchesClientRef } from '../../../../shared/src/utils/clientRef';
import type { TherapyClientSummary } from '../../api';
import { useRouteStateOnce } from '../../hooks/useRouteStateOnce';
import type { AssignPreset } from './assignTemplates';

export const ADD_CLIENT_STATE = { addClient: true };
const addClientTarget = (state: unknown): true | null => ((state as { addClient?: unknown } | null)?.addClient === true ? true : null);

/** С чем открыть лист: пункт каталога — «Своё задание» с его текстом, как «Взять» в листе; без пункта — пустой лист. */
export interface AssignTaskTarget { preset?: AssignPreset }

export function assignTaskState(task: CatalogTask | null): { assignTask: AssignTaskTarget } {
  if (!task) return { assignTask: {} };
  return { assignTask: { preset: { type: 'custom', text: customTaskText({ title: task.title, text: task.variants[0].text }), catalogId: task.id } } };
}

export function assignTaskTarget(state: unknown): AssignTaskTarget | null {
  const target = (state as { assignTask?: { preset?: Partial<AssignPreset> } } | null)?.assignTask;
  if (!target || typeof target !== 'object') return null;
  const { preset } = target;
  const valid = preset?.type === 'custom' && typeof preset.text === 'string' && typeof preset.catalogId === 'string';
  return valid ? { preset: { type: 'custom', text: preset.text, catalogId: preset.catalogId } } : {};
}

interface Params {
  detail: { selectedClient: TherapyClientSummary | null; setShowAssign: (open: boolean) => void };
  openClientRef?: string | null;
  addClient: { setOpen: (open: boolean) => void };
}

/** Лист «Новое задание» карточки: шаблон, с которым он открыт, и открытие по состоянию маршрута. */
export function useCabinetRouteActions({ detail, openClientRef, addClient }: Params) {
  const [assignPreset, setAssignPreset] = useState<AssignPreset | undefined>(undefined);
  const openAssign = (preset?: AssignPreset) => { setAssignPreset(preset); detail.setShowAssign(true); };
  // Цель ждёт карточку: клиент из адреса выбирается после загрузки списка, а его открытие лист закрывает.
  const [routed, setRouted] = useState<AssignTaskTarget | null>(null);
  useRouteStateOnce(assignTaskTarget, setRouted, (target) => target.preset?.catalogId ?? 'blank');
  const onCard = detail.selectedClient != null && matchesClientRef(detail.selectedClient, openClientRef);
  // Состояние в рендере, не в эффекте: цель снимается тем же шагом, что открывает лист.
  if (routed && onCard) { setRouted(null); openAssign(routed.preset); }
  useRouteStateOnce(addClientTarget, () => addClient.setOpen(true));
  return { assignPreset, setAssignPreset, openAssign };
}
