import Phaser from 'phaser';

// Процедурные анимации Йоськи поверх спрайта — кадры не рисуем, двигаем кодом.

/** Игра с клубком: кот наклонён, лапа машет, клубок скачет и получает шлепки */
export function drawYarnPlay(
  gfx: Phaser.GameObjects.Graphics,
  yarn: Phaser.GameObjects.Image,
  player: Phaser.Physics.Arcade.Sprite,
  t: number,
) {
  const dir = player.flipX ? -1 : 1;
  player.setAngle(dir * 8); // наклонился к клубку
  const swing = Math.max(0, Math.sin(t * 2.6)); // 0..1 — замах и удар лапой
  const bx = player.x + dir * (24 + swing * 14) + Math.sin(t * 1.7) * 6;
  const by = player.y - 6 - Math.abs(Math.sin(t * 2.3)) * (10 + swing * 10);
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillEllipse(bx, player.y - 2, 16, 4);
  yarn.setVisible(true).setPosition(bx, by).setAngle(t * 220);
  // лапа: от груди к клубку, машет вниз при ударе
  const px = player.x + dir * 12, py = player.y - 18;
  const ang = -0.7 + swing * 1.3;
  const ex = px + dir * Math.cos(ang) * 17, ey = py + Math.sin(ang) * 15;
  gfx.lineStyle(5, 0x16161c, 1);
  gfx.lineBetween(px, py, ex, ey);
  gfx.fillStyle(0x16161c, 1); gfx.fillCircle(ex, ey, 3.4);
  // шлепок по клубку — искорка
  if (swing > 0.9 && Math.abs(ex - bx) < 16) {
    gfx.fillStyle(0xffc8d6, 0.8); gfx.fillCircle(bx + dir * 4, by - 5, 2.2);
  }
}

/** «Уступил»: голова опускается понуро, вздох «...» */
export function fawnDroop(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
  const dir = player.flipX ? -1 : 1;
  scene.tweens.add({
    targets: player, angle: dir * 14, scaleX: 1.6, scaleY: 1.3,
    duration: 260, ease: 'Sine.Out', yoyo: true, hold: 1000,
    onComplete: () => { player.setAngle(0); player.setScale(1.5, 1.5); },
  });
  const sigh = scene.add.text(player.x - dir * 12, player.y - 48, '...', {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '12px', color: '#8a8a98',
  }).setOrigin(0.5).setDepth(46);
  scene.tweens.add({ targets: sigh, y: sigh.y - 18, alpha: 0, duration: 1500, onComplete: () => sigh.destroy() });
}
