import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { metrikaLoadedInDocument } from '../../lib/metrika';

// S15 (аудит 2026-11): /install — публичная посадочная, Метрика здесь грузится.
// После передачи сессии (useHandoffExchange) SPA-переход в кабинет оставил бы
// tag.js в документе на клинических экранах: шлюз (metrikaGate) глушит хиты,
// но сам скрипт из документа не выгрузить. Тег уже в документе — переход в
// кабинет полной навигацией. Решаем в момент нажатия, а не рендера: тег
// вставляет эффект MetrikaTracker уже ПОСЛЕ отрисовки экрана.
function goToCabinet(e: MouseEvent): void {
  if (!metrikaLoadedInDocument()) return; // тега нет — обычный SPA-переход
  e.preventDefault();
  window.location.assign('/today');
}

export function CabinetLink({ className, children }: { className: string; children: ReactNode }) {
  return <Link className={className} to="/today" onClick={goToCabinet}>{children}</Link>;
}
