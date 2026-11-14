// Кот на сцене: спрайты, свет, плашка реплики, раскладка клавиш.
import { GROUND_Y } from '../../constants';
import { addGlow } from '../../look';
import type { GameScene } from '../GameScene';

// ── Player ───────────────────────────────────────────────────────────────--
export function spawnPlayer(s: GameScene) {
  if (!s.anims.exists('p-idle'))
    s.anims.create({ key: 'p-idle', frames: s.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }), frameRate: 8, repeat: -1 });
  if (!s.anims.exists('p-walk'))
    s.anims.create({ key: 'p-walk', frames: s.anims.generateFrameNumbers('cat_run', { start: 0, end: 5 }), frameRate: 16, repeat: -1 });
  if (!s.anims.exists('p-jump'))
    s.anims.create({ key: 'p-jump', frames: [{ key: 'cat_run', frame: 2 }], frameRate: 1, repeat: 0 });

  s.player = s.physics.add.sprite(100, GROUND_Y - 20, 'cat_idle').setOrigin(0.5, 1).setScale(1.5).setDepth(10);
  const b = s.player.body as Phaser.Physics.Arcade.Body;
  b.setSize(22, 30); b.setOffset(13, 16);
  s.player.setCollideWorldBounds(true); // за дверью гл.3 мир кончается — раньше кот падал с края
  s.player.play('p-idle');
  for (const r of s.floorColliders) s.physics.add.collider(s.player, r);
  for (const r of s.platColliders) s.physics.add.collider(s.player, r);

  // soft light pool — keeps the cat readable in the dark, "your small light"
  s.playerLight = addGlow(s, 0, 0, 260, 260, 0xffe9c0, 0.14, 1);

  s.slash = s.add.graphics().setDepth(11);
  // cat_play/cat_sleep/cat_dash — необязательные спрайты (грузятся отдельными
  // запросами и могут не доехать). Анимацию создаём ТОЛЬКО если текстура есть —
  // иначе .play() по пустой анимации роняет update-цикл и игра «зависает».
  s.safeAnim('p-play', 'cat_play', 0, 5, 7, -1);
  s.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0);
  s.playSprite = s.add.sprite(0, 0, 'cat_play', 0).setOrigin(0.5, 1).setScale(1.5).setDepth(10).setVisible(false);
  s.sleepSprite = s.add.sprite(0, 0, 'cat_sleep', 0).setOrigin(0.5, 1).setScale(1.5).setDepth(10).setVisible(false);
  s.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
  s.lungeSprite = s.add.sprite(0, 0, 'cat_dash', 5).setOrigin(0.5, 1).setScale(1.5).setDepth(11).setVisible(false);
  s.bubble = s.add.text(0, 0, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#fff0d8',
    backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 9, y: 5 }, align: 'center' })
    .setOrigin(0.5, 1).setDepth(45).setAlpha(0);
}

export function setupInput(s: GameScene) {
  s.input.keyboard!.resetKeys(); // залипшие клавиши после смены сцены/alt-tab
  s.cursors = s.input.keyboard!.createCursorKeys();
  // одна схема: движение — стрелки/WASD, действия — Z X C V (как на Денди)
  s.keys = {
    A: s.input.keyboard!.addKey('A'), D: s.input.keyboard!.addKey('D'),
    W: s.input.keyboard!.addKey('W'),
    X: s.input.keyboard!.addKey('X'), C: s.input.keyboard!.addKey('C'),
    Z: s.input.keyboard!.addKey('Z'), V: s.input.keyboard!.addKey('V'),
    E: s.input.keyboard!.addKey('E'), // Акт II: войти в дверь / ответить отговорке
  };
}
