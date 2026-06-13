import Phaser from 'phaser';

// Анимации Йоськи на рисованных кадрах (textures.ts: cat_play0/1, cat_droop).

/** Игра с клубком: кот сидит и бьёт лапой (2 кадра), клубок скачет в ритме */
export function drawYarnPlay(
  gfx: Phaser.GameObjects.Graphics,
  yarn: Phaser.GameObjects.Image,
  player: Phaser.Physics.Arcade.Sprite,
  t: number,
) {
  const dir = player.flipX ? -1 : 1;
  const swing = Math.sin(t * 2.6);            // >0 — лапа замахнулась, <0 — ударила
  player.anims.stop();
  player.setTexture(swing > 0 ? 'cat_play0' : 'cat_play1');
  // клубок: отлетает от удара и прикатывается обратно
  const bx = player.x + dir * (20 + Math.max(0, -swing) * 16) + Math.sin(t * 1.3) * 4;
  const by = player.y - 6 - Math.max(0, Math.sin(t * 2.6 + 2.2)) * 12;
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillEllipse(bx, player.y - 2, 16, 4);
  yarn.setVisible(true).setPosition(bx, by).setAngle(t * 220);
  // шлепок — искорка
  if (swing < -0.85) { gfx.fillStyle(0xffc8d6, 0.8); gfx.fillCircle(bx + dir * 3, by - 6, 2.2); }
}

/** Вышел из игры с клубком — вернуть обычные кадры */
export function endPose(player: Phaser.Physics.Arcade.Sprite) {
  if (player.texture.key !== 'cat_idle' && player.texture.key !== 'cat_run')
    player.play('p-idle', true);
}

/** «Уступил»: понурая поза (рисованный кадр) + вздох «...» */
export function fawnDroop(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
  const dir = player.flipX ? -1 : 1;
  player.anims.stop();
  player.setTexture('cat_droop');
  scene.time.delayedCall(1400, () => {
    if (player.active && player.texture.key === 'cat_droop') player.play('p-idle', true);
  });
  const sigh = scene.add.text(player.x - dir * 12, player.y - 48, '...', {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '12px', color: '#8a8a98',
  }).setOrigin(0.5).setDepth(46);
  scene.tweens.add({ targets: sigh, y: sigh.y - 18, alpha: 0, duration: 1500, onComplete: () => sigh.destroy() });
}
