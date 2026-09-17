import { useEffect, useRef } from 'react';
import type { Section } from '../components/BottomNav';
import { perfMark, tapDone } from './perfLog';

// Замыкает замер тапа по вкладке (см. perfLog.ts): tapStart зовёт BottomNav
// на pointerdown, а этот хук после смены section ждёт двойной rAF — момент,
// когда новый экран реально отрисован кадром, — и записывает длительность.
// Живёт отдельным хуком, а не в App.tsx: App — файл-должник размера
// (правило №10), инструментация в нём заняла бы ~15 строк.
export function usePerfTapTracking(
  section: Section,
  prerenderedSections: Set<Section>,
  loading: boolean,
): void {
  useEffect(() => {
    perfMark('экран');
  }, []);
  useEffect(() => {
    if (!loading) perfMark('данные');
  }, [loading]);

  // Реф-зеркало, чтобы эффект ниже зависел только от section: смена набора
  // прогретых вкладок сама по себе замер не перезапускает.
  const prerenderedRef = useRef(prerenderedSections);
  prerenderedRef.current = prerenderedSections;
  const shownRef = useRef<Set<Section>>(new Set());

  useEffect(() => {
    const cold =
      !shownRef.current.has(section) && !prerenderedRef.current.has(section);
    shownRef.current.add(section);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => tapDone(section, cold)),
    );
    return () => cancelAnimationFrame(id);
  }, [section]);
}
