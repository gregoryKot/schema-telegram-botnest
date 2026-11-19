// Все сцены игры; порядок — первая стартует сама (Boot), остальные по ключу.
import { BootScene } from './BootScene';
import { StartScene } from './StartScene';
import { IntroScene } from './IntroScene';
import { TutorialScene } from './TutorialScene';
import { GameScene } from './GameScene';
import { WeekScene } from './WeekScene';

export const SCENES = [BootScene, StartScene, IntroScene, TutorialScene, GameScene, WeekScene];
