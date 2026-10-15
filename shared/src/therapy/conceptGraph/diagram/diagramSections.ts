// Заголовки секций диаграммы: название, подсказка «о чём это» и подпись кнопки
// добавления. Кнопка у каждой секции своя — «+ режим» и «+ схема» в разных
// колонках, а не один выбор на всю диаграмму.
import type { AddSection, DiagramSection } from './diagramTypes';

type Meta = Pick<DiagramSection, 'title' | 'hint' | 'add'>;

export const SECTION_META: Record<AddSection, Meta> = {
  modes: {
    title: 'Режимы',
    hint: 'Что говорят и делают',
    add: '+ режим',
  },
  schemas: {
    title: 'Схемы',
    hint: 'Во что верят и откуда это',
    add: '+ схема',
  },
  healthy: {
    title: 'Здоровые режимы',
    hint: 'На что опираются',
    add: '+ режим',
  },
};

/** Высота строки заголовка секции: кнопка 44 и воздух над фигурами. */
export const HEAD_H = 56;

export function section(
  id: AddSection,
  x: number,
  y: number,
  w: number,
): DiagramSection {
  return { id, ...SECTION_META[id], x, y, w };
}
