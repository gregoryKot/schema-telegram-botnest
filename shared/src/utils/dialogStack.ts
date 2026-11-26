import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Стек открытых диалогов и листов — один на Tab-трап и Escape (useDialogA11y, useHistorySheet): слои
// со своими слушателями дрались (аудит 2026-10). Слушатель Escape один, на window в фазе capture;
// Escape берёт верхний слой, который его не пропускает: onEscape — закрывается сам, holdEscape —
// несворачиваемое окно держит Escape, ни того ни другого — прозрачен (фокус-трап листа). Лист
// (kind 'sheet') закрывается сам во всплытии (ownsEscape): поле ввода может погасить Escape.
// Верхний — с наибольшим номером из render, не по порядку эффектов: эффекты ребёнка идут раньше
// родительских, и вложенный слой, смонтированный в одном коммите с родителем, оказался бы под ним.
interface Layer {
  seq: number;
  sheet: boolean;
  // Читаются в момент нажатия: свежие опции без пересоздания слоя.
  opts: () => LayerOpts;
}
export interface LayerOpts {
  onEscape?: () => void;
  holdEscape?: boolean;
  kind?: 'dialog' | 'sheet';
}

let layers: Layer[] = [];
let counter = 0;
// Подписчики «открыт ли хоть один диалог» (useAnyDialogOpen).
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Чей Escape: верхний слой, который его не пропускает. */
function escapeOwner(): Layer | undefined {
  for (let i = layers.length - 1; i >= 0; i--) {
    const { onEscape, holdEscape } = layers[i].opts();
    if (layers[i].sheet || onEscape || holdEscape) return layers[i];
  }
  return undefined;
}

function onKeyDown(e: KeyboardEvent) {
  const owner = e.key === 'Escape' ? escapeOwner() : undefined;
  if (!owner || owner.sheet) return; // лист закроется во всплытии
  e.preventDefault(); // закрылся сам или держит Escape: листы под ним его не получат
  owner.opts().onEscape?.();
}

function pushLayer(layer: Layer) {
  if (layers.length === 0) window.addEventListener('keydown', onKeyDown, true);
  layers = [...layers, layer].sort((a, b) => a.seq - b.seq);
  emit();
}

function removeLayer(layer: Layer) {
  layers = layers.filter((l) => l !== layer);
  if (layers.length === 0)
    window.removeEventListener('keydown', onKeyDown, true);
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Открыт ли хоть один модальный диалог: уведомления (баннер куки) ждут под ним, а не лежат поверх (QA 2026-11). */
export function useAnyDialogOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => layers.some((l) => !l.sheet), // листы отмечает openSheets
    () => false,
  );
}

// Слой: join() вызывают из эффекта монтирования (возвращает отписку), isTop() и
// ownsEscape() — из обработчика клавиши. Объект стабилен между рендерами.
export function useDialogLayer(opts: LayerOpts) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  // Один объект на всё время жизни слоя: годится в зависимости эффекта.
  const [handle] = useState(() => {
    const sheet = opts.kind === 'sheet';
    const layer: Layer = { seq: ++counter, sheet, opts: () => optsRef.current };
    return {
      join: () => {
        pushLayer(layer);
        return () => removeLayer(layer);
      },
      isTop: () => layers[layers.length - 1] === layer,
      ownsEscape: () => escapeOwner() === layer,
    };
  });
  return handle;
}
