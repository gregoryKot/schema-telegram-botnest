import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import { ChapterConfig } from './chapters';
import { placeProp, LAMP_W } from './props';
import { buildRoom } from './room';
import { loadSkies } from './sky';
import { lampSpots } from './lampSpots';
import farUrl from './assets/bg_street_far.png';
import midUrl from './assets/bg_street_mid.png';
import nearUrl from './assets/bg_street_near.png';
import roadFarUrl from './assets/bg_road_far.png';
import roadMidUrl from './assets/bg_road_mid.png';
import roadNearUrl from './assets/bg_road_near.png';
import { placeGrid } from './gridProp';

// Декорации — характер уровня: гл.1 — улица на закате (фонари), гл.2 — комната,
// гл.3 — дорога перед рассветом (указатели «вперёд»); слои фона — пиксель-арт.
export function buildDecor(scene: Phaser.Scene, ch: ChapterConfig) {
  if (ch.theme === 'room') return buildRoom(scene, ch);
  buildLayers(scene, ch);
  if (ch.theme === 'road')
    for (let sx = 480; sx < ch.arenaW - 200; sx += 700) placeGrid(scene, 'prop_signpost', sx, GROUND_Y + 6, 4);
  // фонари: свет — в спрайте (game/art/light.py)
  else for (const lx of lampSpots(ch.arenaW, ch.pits)) placeProp(scene, 'prop_streetlamp', lx, GROUND_Y, LAMP_W, 4);
}

// ── Три слоя пиксель-арта на тему (game/art/street.py, near.py, road.py): дальний, средний, ближний ──
type Layer = [key: string, url: string, sf: number, depth: number];
const LAYERS: Record<string, Layer[]> = {
  street: [['bg_street_far', farUrl, 0.15, -7], ['bg_street_mid', midUrl, 0.4, -6], ['bg_street_near', nearUrl, 0.75, -4]],
  road: [['bg_road_far', roadFarUrl, 0.15, -7], ['bg_road_mid', roadMidUrl, 0.4, -6], ['bg_road_near', roadNearUrl, 0.75, -4]],
};
export function loadStreetLayers(scene: Phaser.Scene) { // data-URI, грузит BootScene
  for (const [key, url] of Object.values(LAYERS).flat()) if (!scene.textures.exists(key)) scene.load.image(key, url);
  loadSkies(scene);
}
function buildLayers(scene: Phaser.Scene, ch: ChapterConfig) {
  for (const [key, , sf, depth] of LAYERS[ch.theme] ?? []) {
    if (!scene.textures.exists(key)) continue;
    const src = scene.textures.get(key).getSourceImage();
    const w = (ch.arenaW * sf + W + 64) / 2; // ширина в пикселях текстуры, показ ×2
    scene.add.tileSprite(-32, GROUND_Y, w, src.height, key).setOrigin(0, 1).setScale(2)
      .setScrollFactor(sf, 1).setDepth(depth); // по вертикали слой стоит на земле
  }
}
