import { defusionMore as defusionBase } from './defusionMore';
import { flashcardsYoungMore as flashcardsBase } from './homeworkYoung';
import { limitSettingMore as limitBase } from './relationshipHeath';
import { mindfulnessMore as mindfulnessBase } from './compassionHeath';
import { behavioralExperimentMore as experimentBase } from './arntzTechniqueMore';

/** Дополнения из книги о парах к техникам: вынесено, чтобы файлы техник не росли. */
export { defusionVoice } from './defusionMore';
export { cognitiveWorkYoungMore } from './homeworkYoung';
export { positiveDataLogSteps } from './arntzTechniqueMore';

export const defusionMore: string[] = [
  ...defusionBase,
  'Тяжёлые воспоминания можно назвать «призраками прошлого»: принять отпечаток, отпустить мысль («растворение» из ACT) и переключиться на здоровое дело [Пары, гл. 8]. Если клиенту легче спорить с голосами, терапевт помогает спорить — собирает доводы против них.',
  'Голоса Требовательного Критика наблюдают как проезжающие мимо машины, а сами сидят в придорожном кафе [Пары, гл. 8]. Домашнее задание паре — нарисовать режимы или собрать из журнальных картинок коллаж с именами партнёров.',
];

export const flashcardsYoungMore: string[] = [
  ...flashcardsBase,
  'Для пары [Пары, гл. 9]: список альтернативных реакций на главные схемы и карточка на момент активации. Партнёры показывают друг другу новое поведение и дают обратную связь; письма обидчику читают в кабинете и не отправляют.',
];

export const behavioralExperimentMore: string[] = [
  ...experimentBase,
  'Эксперимент в паре [Пары, гл. 9]: например, больше нежности с прогнозом заранее и замером SUD до и после. Сами терапевтические отношения тоже тренажёр просьбы о потребностях; цель — «достаточно хорошее» удовлетворение, а не идеальное.',
];

export const mindfulnessMore: string[] = [
  ...mindfulnessBase,
  '«Коробка передач» [Пары, гл. 9]: нейтраль — отделиться от вспыхнувшего; выбор передачи — переоценить с позиции Мудрого Разума или лучшего друга, помня о потребностях и долгосрочных целях; включить передачу самоинструкцией. Задача Здорового Взрослого — вынырнуть и держать голову над водой; осознанность здесь направляет сознание, а не только созерцает.',
];

export const limitSettingMore: string[] = [
  ...limitBase,
  '«Добросовестный родитель» [Пары, гл. 9]: для Импульсивного и Недисциплинированного Ребёнка, выросшего из баловства, терапевт признаёт потребность, сомневается в способе и эмпатически ставит границу.',
];
