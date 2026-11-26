import * as base from './transitionalObjects';
import { transitionalHeathMore } from './transitionalObjectsHeath';

/** Шаги и «Подробнее» к transitional_objects с дополнениями Хис (гл. 19, 20): вынесено, чтобы файл не рос. */
export const transitionalObjectsSteps: string[] = base.transitionalObjectsSteps;

export const transitionalObjectsMore: string[] = [
  ...base.transitionalObjectsMore,
  'Вещь-послание в короткой терапии [Хис, гл. 19]. Ручка, которой писали на сессии, запись голоса терапевта, брелок с фигуркой, которая напоминает: теперь клиент в безопасности и может защитить себя сам. Такую вещь удобно дать перед отпуском терапевта.',
  'Камень на прощание [Хис, гл. 20]. Небольшой камень, шероховатый и неидеальный, но красивый и крепкий. Клиент носит его в кармане и, когда слышит Карающего Критика, трогает камень и вспоминает слова терапевта: идеальным быть необязательно, своё мнение имеет право на жизнь.',
  ...transitionalHeathMore,
];
