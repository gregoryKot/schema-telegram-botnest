import type { SchemaDomainGuideBuilder } from '../types';
import { buildInhibitionGuides } from './vigilanceInhibition';
import { buildNegativityGuide } from './vigilanceNegativity';
import { buildPunitivenessGuides } from './vigilancePunitive';
import { buildUnrelentingStandardsGuide } from './vigilanceStandards';

// Справочник, разделы 15–18; записи — по файлам vigilance*.ts. Пары
// сайта: «Подавление эмоций» разведено на страх срыва и сдержанность из
// стыда, «Пунитивность» — на себя и на других.
// Детские режимы без своего id: Разочарованный и Испуганный → Уязвимый,
// «Плохой» → Униженный, Бунтующий → Упрямый, Обиженный → Сердитый.

/** Домен vigilance: negativity, emotion_inhibition_fear, emotional_inhibition, unrelenting_standards, punitiveness_self, punitiveness_others. */
export const buildVigilanceGuides: SchemaDomainGuideBuilder = (tr) => ({
  domainId: 'vigilance',
  note: 'Здесь не закрыта потребность в спонтанности и игре, поэтому одной работы с Критиками не хватит: нужно прямо растить Счастливого Ребёнка. Общество эти схемы часто одобряет, они приносят успех, и меняться не хочется, пока не посчитана цена.',
  schemas: [
    buildNegativityGuide(tr),
    ...buildInhibitionGuides(tr),
    buildUnrelentingStandardsGuide(tr),
    ...buildPunitivenessGuides(tr),
  ],
});
