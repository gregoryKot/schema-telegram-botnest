import type { RafaeliTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Рафаэли, Бернштейн и Янга. */
export const RAFAELI_TECHNIQUE_WORK: Record<
  RafaeliTechniqueId,
  TechniqueWorkDef
> = {
  rupture_repair: {
    name: 'Ремонт разрыва с терапевтом',
    fields: [
      ['moment', 'Что произошло между нами'],
      ['named', 'Как назвали и какую долю признали'],
      ['link', 'Какая схема или копинг включились и откуда знакомо'],
      ['next', 'Что проработали или отрепетировали'],
    ],
  },
  historical_life_review: {
    name: 'Исторический обзор жизни',
    fields: [
      ['schema', 'Схема словами клиента'],
      ['pro', 'Доводы за по этапам'],
      ['contra', 'Доводы против по этапам'],
      ['result', 'Вывод'],
    ],
  },
};
