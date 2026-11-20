import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSection } from './GuideSection';
import { GuidePoints } from './GuidePoints';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';
import { schemaGuideLook } from './guideLook';
import { articleAddress } from './marks/guideMarkModel';

type Props = GuideSheetActions & { schemaName: string; view: SchemaGuideView };

// Три стиля копинга — порядок справочника; пустая строка не показывается.
const COPING = [
  ['surrender', 'Капитуляция'],
  ['avoidance', 'Избегание'],
  ['overcompensation', 'Гиперкомпенсация'],
] as const;

/**
 * Лист схемы (#995): герой — суть схемы и знак её домена на бумаге домена (schemaGuideLook), «Как это
 * звучит» — фраза репарентинга (кавычки ставит лист, в данных их нет) и реплики
 * `voice`, потребность, как схема видна в кабинете, «Что делать» — интервенции
 * пунктами, затем общий хвост листа раздела (GuideSheet): техники «На сессии»,
 * задания «Между сессиями». Под «Подробнее» — копинг тремя стилями, типичные
 * режимы (названия из реестра; id без режима пропускается), общее для домена и
 * «Где застревают». Пустой раздел не рисуется. Открывается «Подробнее о схеме»
 * на плашке «Обычно в методе».
 */
export function SchemaGuideSheet({ schemaName, view, ...actions }: Props) {
  const { guide, domainNote } = view;
  const at = articleAddress('schema', guide.schemaId);
  const coping = COPING.filter(([key]) => guide.coping[key].trim());
  const modes = guide.modeIds.flatMap((id) => getModeById(id)?.name ?? []);
  const voice = [guide.reparenting, ...(guide.voice ?? [])];
  const interventions = guide.interventions.filter((i) => i.trim());
  const copingList = coping.length > 0 && (
    <dl className="gd-coping">
      {coping.map(([key, label]) => (
        <div key={key}>
          <dt className="gd-text gd-text--strong">{label}</dt>
          <dd className="gd-text">{guide.coping[key]}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <GuideSheet
      label="Схема" title={schemaName} lede={guide.essence} voice={voice} view={view} {...actions}
      look={schemaGuideLook(guide.schemaId)} at={at}
      moreParts={[
        { title: 'Копинг', children: copingList || undefined },
        { title: 'Типичные режимы', text: modes.join(', '), address: at('modeIds') },
        { title: 'Общее для домена', text: domainNote, address: at('domainNote') },
      ]}
    >
      <GuideSection title="Потребность" text={guide.need} address={at('need')} />
      <GuideSection title="В кабинете" text={guide.inSession} address={at('inSession')} />
      {interventions.length > 0 && (
        <GuideSection title="Что делать" address={at('interventions')}>
          <GuidePoints items={interventions} />
        </GuideSection>
      )}
    </GuideSheet>
  );
}
