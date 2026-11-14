// Движение кота: бег, прыжок (coyote/буфер), рывок, залипание, ввод копингов.
import Phaser from 'phaser';
import { PHYS } from '../../constants';
import { audio } from '../../audio';
import { touch } from '../../controls';
import type { GameScene } from '../GameScene';
import { doFawn, ATTACK_MS, ATTACK_CD } from './attack';

const RUN_SPEED = 250;
const DASH_SPEED = 560;
const DASH_MS   = 170;
const DASH_CD   = 480;

// game feel
const COYOTE_MS = 90;        // прыжок прощается N мс после схода с платформы
const JUMP_BUFFER_MS = 130;  // прыжок, нажатый до приземления, срабатывает при касании
const RISE_GRAVITY = -210;   // при удержании прыжка — легче (плавный взлёт)
const FALL_GRAVITY = 520;    // при падении — тяжелее (быстрое, чёткое приземление)

export function updateMoves(s: GameScene, dt: number) {
  const b = s.player.body as Phaser.Physics.Arcade.Body;
  const onGround = b.blocked.down;
  const left  = s.cursors.left.isDown  || s.keys.A.isDown || touch.left;
  const right = s.cursors.right.isDown || s.keys.D.isDown || touch.right;
  const jump  = Phaser.Input.Keyboard.JustDown(s.cursors.up) || Phaser.Input.Keyboard.JustDown(s.cursors.space)
             || Phaser.Input.Keyboard.JustDown(s.keys.W) || touch.consume('jump');
  const jumpHeld = s.cursors.up.isDown || s.cursors.space.isDown || s.keys.W.isDown || touch.jumpHeld;
  let hit   = Phaser.Input.Keyboard.JustDown(s.keys.X) || touch.consume('hit');
  let fawn  = Phaser.Input.Keyboard.JustDown(s.keys.V) || touch.consume('fawn');
  // ИЗБЕГАНИЕ — один копинг, одна кнопка: тап = рывок, удержание = залипнуть
  let avoidPress = Phaser.Input.Keyboard.JustDown(s.keys.Z) || touch.consume('avoid');
  let avoidHeld  = s.keys.Z.isDown || touch.avoidHeld;
  // у двери терапевта копинги гаснут: против выбора они бессмысленны
  if (s.copingsOff) {
    if (hit || fawn || avoidPress || avoidHeld) s.sayOnce('nocope', 'm_no_coping_here', 2400);
    hit = false; fawn = false; avoidPress = false; avoidHeld = false;
  }
  const dash = avoidPress;
  // на кадре нажатия — это рывок, не залипание (иначе frozen гасит рывок)
  s.frozen = avoidHeld && !avoidPress && onGround && !s.dashing && !s.attacking;
  if (fawn && !s.dead) doFawn(s);
  if (s.frozen && !s.wasFrozen) audio.freeze();
  s.wasFrozen = s.frozen;

  // light pool follows the cat
  s.playerLight.x = s.player.x; s.playerLight.y = s.player.y - 22;

  // record trail for the self-critic mirror
  s.trail.push({ x: s.player.x, y: s.player.y, flip: s.player.flipX });
  if (s.trail.length > 90) s.trail.shift();

  if (s.dashCd > 0) s.dashCd -= dt;

  // ── ОТВЛЕКИСЬ: показываем спрайт «играет с клубком» ──
  if (s.frozen) {
    b.setVelocityX(0);
    showPlay(s);
  } else {
    s.hidePlay();
  }

  // ── РЫВОК (dash) — i-frames + afterimage ──
  if (dash && s.dashCd <= 0 && !s.frozen) {
    s.dashing = true; s.dashT = DASH_MS; s.dashCd = DASH_CD;
    s.dashDir = (left && !right) ? -1 : (right ? 1 : (s.player.flipX ? -1 : 1));
    s.player.setFlipX(s.dashDir < 0);
    s.invuln = Math.max(s.invuln, DASH_MS + 40);
    b.setAllowGravity(false); b.setVelocityY(0);
    s.burst(s.player.x - s.dashDir * 14, s.player.y - 18, 0x9fd0ff, 6, 90);
    audio.dash();
  }
  if (s.dashing) {
    s.dashT -= dt;
    b.setVelocityX(s.dashDir * DASH_SPEED);
    ghost(s); // синий шлейф i-кадров — рывок как был
    if (s.dashT <= 0) { s.dashing = false; b.setAllowGravity(true); }
  } else if (!s.frozen) {
    // ── БЕГИ ──
    const run = RUN_SPEED * s.speedMult;
    if (s.attacking) b.setVelocityX(s.player.flipX ? -50 : 50);
    else if (right) { b.setVelocityX(run); s.player.setFlipX(false); }
    else if (left)  { b.setVelocityX(-run); s.player.setFlipX(true); }
    else            { b.setVelocityX(b.velocity.x * 0.7); }

    // ── ПРЫЖОК: coyote time + jump buffer + вариативная высота + дуга ──
    if (onGround) { s.coyoteT = COYOTE_MS; if (!s.wasOnGround) onLand(s); }
    else s.coyoteT = Math.max(0, s.coyoteT - dt);
    s.jumpBufferT = jump ? JUMP_BUFFER_MS : Math.max(0, s.jumpBufferT - dt);
    if (s.jumpBufferT > 0 && s.coyoteT > 0) {
      b.setVelocityY(PHYS.jumpVel); audio.jump();
      s.player.setScale(1.3, 1.75); // вытягивается на отрыве, плавно к норме
      s.tweens.add({ targets: s.player, scaleX: 1.5, scaleY: 1.5, duration: 220, ease: 'Quad.Out' });
      s.jumping = true; s.coyoteT = 0; s.jumpBufferT = 0;
    }
    // отпустил на взлёте — короткий подскок
    if (s.jumping && !jumpHeld && b.velocity.y < 0) { b.setVelocityY(b.velocity.y * 0.45); s.jumping = false; }
    if (b.velocity.y >= 0) s.jumping = false;
    // непараболическая дуга: вверх с удержанием — легче, вниз — тяжелее
    if (!onGround) b.setGravityY(b.velocity.y < 0 && jumpHeld ? RISE_GRAVITY : FALL_GRAVITY);
    else b.setGravityY(0);
    s.wasOnGround = onGround;

    if (!onGround) { if (s.player.anims.currentAnim?.key !== 'p-jump') s.player.play('p-jump', true); }
    else if (Math.abs(b.velocity.x) > 20) s.player.play('p-walk', true);
    else s.player.play('p-idle', true);
    // на земле в покое и без активного твина — вернуть базовый масштаб
    if (onGround && !s.jumping && !s.tweens.isTweening(s.player)) s.player.setScale(1.5, 1.5);
  }

  // ── БЕЙ ── (короткие i-кадры на замах — копинг сохраняет в моменте)
  if (hit && s.attackCd <= 0 && !s.frozen && !s.dashing) {
    s.attacking = true; s.attackT = ATTACK_MS; s.attackCd = ATTACK_CD; s.attackHit.clear();
    s.invuln = Math.max(s.invuln, ATTACK_CD + 40); // копинг сохраняет в моменте — пробить нельзя
  }

  s.player.setAlpha(s.invuln > 0 && !s.dashing ? (Math.sin(s.invuln * 0.05) * 0.5 + 0.5) : 1);
}

// приземление: облачко пыли + лёгкий squash — вес и тактильность
function onLand(s: GameScene) {
  s.player.setScale(1.7, 1.3);
  s.tweens.add({ targets: s.player, scaleX: 1.5, scaleY: 1.5, duration: 110, ease: 'Quad.Out' });
  for (let i = 0; i < 5; i++) {
    const dx = (Math.random() - 0.5) * 28;
    const p = s.add.rectangle(s.player.x + dx, s.player.y - 2, 3, 3, 0xc8bcd8, 0.7).setDepth(9);
    s.tweens.add({ targets: p, x: p.x + dx * 1.5, y: p.y - Math.random() * 8, alpha: 0, duration: 280, onComplete: () => p.destroy() });
  }
}

function ghost(s: GameScene) {
  const g = s.add.image(s.player.x, s.player.y, s.player.texture.key, s.player.frame.name)
    .setOrigin(0.5, 1).setScale(s.player.scaleX, s.player.scaleY).setFlipX(s.player.flipX)
    .setTint(0x9fd0ff).setAlpha(0.5).setDepth(9);
  s.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
}

// «Отвлечься» = Мистер играет с клубком; мысли теряют к нему интерес
function showPlay(s: GameScene) {
  s.safeAnim('p-play', 'cat_play', 0, 5, 7, -1); // спрайт грузится в фоне — создаём при первом использовании
  if (!s.anims.exists('p-play')) return; // клубок не доехал — кот просто стоит, без анимации
  if (!s.playSprite.visible) {
    s.playSprite.setVisible(true).play('p-play');
    s.player.setVisible(false);
  }
  s.playSprite.setPosition(s.player.x, s.player.y).setFlipX(s.player.flipX);
}
