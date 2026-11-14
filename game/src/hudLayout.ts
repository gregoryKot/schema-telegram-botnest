import Phaser from 'phaser';
import { W } from './constants';
import { BUBBLE_EDGE, clampBubbleX, hudRightEdge } from './hudMath';

/** Пузырь реплики над точкой x, но целиком внутри кадра: у стены он сдвигается, а не режется краем. */
export function pinBubble(b: Phaser.GameObjects.Text, x: number, y: number): void {
  if (b.style.wordWrapWidth !== W - 2 * BUBBLE_EDGE) b.setWordWrapWidth(W - 2 * BUBBLE_EDGE);
  b.setPosition(clampBubbleX(x, b.width, W), y);
}

/**
 * Правый край для HUD в верхнем углу, левее HTML-кнопки меню. Кнопка стоит в пикселях окна,
 * а холст масштабируется — на узком окне фиксированный отступ в координатах игры уходил под неё.
 */
export function rightClearOfMenu(scene: Phaser.Scene, margin = 18): number {
  const menu = document.getElementById('menu-btn')?.getBoundingClientRect();
  return hudRightEdge(menu, scene.game.canvas.getBoundingClientRect(), W, margin);
}

/** Держит текст у правого края, левее кнопки меню, и при смене размера окна. */
export function pinLeftOfMenu(scene: Phaser.Scene, txt: Phaser.GameObjects.Text): void {
  const place = () => { if (txt.active) txt.setX(rightClearOfMenu(scene)); };
  place();
  scene.scale.on(Phaser.Scale.Events.RESIZE, place);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, place));
}
