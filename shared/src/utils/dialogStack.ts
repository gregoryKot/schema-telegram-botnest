import { useEffect, useRef, useState } from 'react';

// Стек открытых диалогов: один на Tab-трап и Escape (useDialogA11y).
// Два слоя с собственными слушателями дрались: Escape звал onClose у каждого
// смонтированного шита, а трапы по очереди тянули фокус к себе (аудит
// 2026-10). Теперь слушатель Escape один, на window в фазе capture: он идёт
// раньше любых document-слушателей и ставит preventDefault, когда слой
// закрылся сам, — поэтому useHistorySheet пропускает такое событие.
//
// Верхний слой — с наибольшим номером из render, а не по порядку эффектов:
// эффекты ребёнка срабатывают раньше родительских, и вложенный диалог,
// смонтированный в одном коммите с родителем, иначе оказался бы под ним.
interface Layer {
  seq: number;
  // Читается в момент нажатия: свежий onClose без пересоздания слоя.
  getEscape: () => (() => void) | undefined;
}
export interface LayerOpts {
  onEscape?: () => void;
}

let layers: Layer[] = [];
let counter = 0;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  // Слушатель живёт, только пока стек не пуст.
  const escape = layers[layers.length - 1].getEscape();
  // Верхний слой без onEscape (несворачиваемый) нижние не закрывает.
  if (!escape) return;
  e.preventDefault();
  escape();
}

function pushLayer(layer: Layer) {
  if (layers.length === 0) window.addEventListener('keydown', onKeyDown, true);
  layers = [...layers, layer].sort((a, b) => a.seq - b.seq);
}

function removeLayer(layer: Layer) {
  layers = layers.filter((l) => l !== layer);
  if (layers.length === 0)
    window.removeEventListener('keydown', onKeyDown, true);
}

// Слой диалога: join() вызывают из эффекта монтирования (возвращает отписку),
// isTop() — из обработчика клавиши. Объект стабилен между рендерами.
export function useDialogLayer({ onEscape }: LayerOpts) {
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });
  // Один объект на всё время жизни диалога: годится в зависимости эффекта.
  const [handle] = useState(() => {
    const layer: Layer = { seq: ++counter, getEscape: () => escapeRef.current };
    return {
      join: () => {
        pushLayer(layer);
        return () => removeLayer(layer);
      },
      isTop: () => layers[layers.length - 1] === layer,
    };
  });
  return handle;
}
