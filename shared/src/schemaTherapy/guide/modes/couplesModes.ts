import { healthyAdultMore as healthyAdultBase } from './healthyAdultArntz';
import { detachedMore as detachedBase } from './detachedProtectorArntz';
import { punitiveMore as punitiveBase } from './punitiveCriticArntz';
import { vulnerableChildMore as vulnerableBase } from './vulnerableChildRoediger';
import { angryChildMoreBpd as angryBase } from './angryChildBpd';
import { undisciplinedMore as undisciplinedBase } from './undisciplinedChildMore';
import { demandingCriticFarrell as demandingBase } from './criticFarrell';

/** Дополнения из книги о парах к разделам режимов: вынесено, чтобы файлы разделов не росли. */
export { healthyAdultBetween } from './healthyAdultArntz';
export { punitiveVoice } from './punitiveCriticArntz';
export { angryChildMoreTechniques } from './angryChildBpd';

const criticHealthyPart =
  'В Критике есть и здоровая часть — нравственные ценности. Её приписывают Здоровому Взрослому: клиент не теряется, когда терапевт занят только негативным посланием, и учится смягчать Требовательного Критика и оспаривать Карающего [Пары, гл. 6].';

export const healthyAdultMore: string[] = [
  ...healthyAdultBase,
  'Три процесса Здорового Взрослого по Рёдигеру: осознанное самонаблюдение, беспристрастная переоценка, плодотворное самообучение. От Отстранённого Защитника отличается тем, что остаётся в контакте с базовыми эмоциями и не идёт на поводу у социальных — стыда, вины, превосходства [Пары, гл. 6].',
  'Здоровый Взрослый — «исполнительный орган» [Пары, гл. 12]: питает и защищает Уязвимого Ребёнка, ставит границы Сердитому и Недисциплинированному Ребёнку, обезоруживает копинг и родительские режимы. Помогают серфинг побуждений (наблюдать, как оно нарастает и спадает), осознанность как дистанция и синтез принятия и изменения. Убеждения, которые не меняются, не переубеждают, а распознают и прерывают копинг.',
];

export const detachedMore: string[] = [
  ...detachedBase,
  'Отличить от Здорового Взрослого [Пары, гл. 6]: оба выглядят разумно, но Здоровый Взрослый остаётся в контакте с базовыми эмоциями и не закрывается, а отстранённый разум их отключает.',
];

export const punitiveMore: string[] = [...punitiveBase, criticHealthyPart];

export const demandingCriticFarrell: string[] = [
  ...demandingBase,
  criticHealthyPart,
];

export const vulnerableChildMore: string[] = [
  ...vulnerableBase,
  'Шесть базовых эмоций Экмана сводятся к двум детским режимам [Пары, гл. 8]: страх и печаль — Уязвимый Ребёнок (болит привязанность), гнев и отвращение — Сердитый (задет запрос на самоутверждение). Доступ к эмоции открывает вопрос «что чувствуешь в груди или животе?». Режимы — плавный спектр, обе системы бывают активны сразу.',
];

export const angryChildMoreBpd: string[] = [
  ...angryBase,
  'Гнев и отвращение — Сердитый Ребёнок: задет запрос на самоутверждение; страх и печаль — Уязвимый [Пары, гл. 8]. Это спектр, а не две коробки; чтобы выйти на эмоцию, спрашивают о теле — что в груди или животе.',
];

export const undisciplinedMore: string[] = [
  ...undisciplinedBase,
  'Импульсивный и Недисциплинированный Ребёнок растут из баловства или перегрузки ответственностью, а не из наказания за чувства [Пары, гл. 9]. Терапевт — «добросовестный родитель»: признаёт потребность, сомневается в способе, эмпатически ставит границы. За «хочу измениться, но не делаю» может стоять Упрямый Ребёнок: его называют и приглашают отказаться от упрямства, чтобы получить помощь.',
];
