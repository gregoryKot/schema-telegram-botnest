import { OCD_SECTIONS } from './ocdSections';
import { ocdComorbidity, ocdDifferential } from './ocdMore';
import type { ConcernGuideBuilder } from './types';

/** ОКР: Кембридж гл. 13 (боксы 13.1–13.3, табл. 13.2) плюс Янг, Хис, Арнтц; работа — ocdSections.ts. */
export const buildOcdGuide: ConcernGuideBuilder = (tr) => ({
  id: 'ocd',
  name: 'ОКР',
  goal: 'Отличить голос Предупреждающего Защитника от Здорового Взрослого и открыть чувства Уязвимого Ребёнка за ритуалами',
  essence:
    'Схема-терапия описывает ОКР двумя переоценками: риска и тяжести опасности (Компульсивный Гиперконтролёр; в главе — «Предупреждающий» режим) и личной ответственности (Критик). Вина и ответственность — ядро [Кембридж, гл. 13].',
  comorbidity: ocdComorbidity,
  differential: ocdDifferential,
  modeIds: [
    'vulnerable_child',
    'guilt_critic',
    'punitive_critic',
    'compulsive_oc',
    'worrying_oc',
    'avoidant_protector',
    'healthy_adult',
  ],
  modeModel:
    'Бокс 13.2. Уязвимый Ребёнок боится опасности, вины и ответственности. Критик раздувает ответственность. Компульсивный Гиперконтролёр («Предупреждающий» копинг в главе) переоценивает риск и выполняет ритуалы. Избегающий Защитник обходит триггеры и подавляет мысли [Кембридж, гл. 13, бокс 13.2].',
  schemaIds: [
    'vulnerability',
    'defectiveness',
    'emotional_deprivation',
    'abandonment',
    'dependence',
  ],
  ...OCD_SECTIONS,
  voice: [
    tr(
      'Сейчас говорит голос, который всегда кричит об опасности. Давай пересадим его на другой стул и спросим, чего он боится.',
      'Сейчас говорит голос, который всегда кричит об опасности. Давайте пересадим его на другой стул и спросим, чего он боится.',
    ),
  ],
  sources:
    '[Кембридж, гл. 2, 13, 18, 20], [Янг, гл. 1, 5, 7, 8], [Хис, гл. 5, 6], [Арнтц, 5.4.4]',
});
