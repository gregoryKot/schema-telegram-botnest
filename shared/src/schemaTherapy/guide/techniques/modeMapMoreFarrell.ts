import { modeMapMore as modeMapMoreBase } from './modeMapMore';
import { modeMapFarrell } from './modeMapFarrellMore';

/** «Подробнее» к технике mode_map с дополнениями по Фаррелл: вынесено, чтобы запись не росла. */
export const modeMapMore: string[] = [
  ...modeMapMoreBase,
  'Задание «Картина моих режимов»: клиент рисует два круга — какую долю сейчас занимают шесть режимов и каким было бы более здоровое распределение. Картину достраивают на последней встрече с объяснениями, потом она становится основой концептуализации [Фаррелл, 4.3, 5.1].',
  ...modeMapFarrell,
];
