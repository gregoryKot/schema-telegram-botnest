import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { DomainArt } from '../../art/DomainArt';
import { schemaDomain } from '../../art/guideSignsModel';
import { GuideSection } from './GuideSection';
import { GuidePoints, GuideSheet, type GuideSheetActions } from './GuideSheet';
import { guideTextStyle } from './guideStyles';

type Props = GuideSheetActions & { schemaName: string; view: SchemaGuideView };

// Три стиля копинга — порядок справочника; пустая строка не показывается.
const COPING = [
  ['surrender', 'Капитуляция'],
  ['avoidance', 'Избегание'],
  ['overcompensation', 'Гиперкомпенсация'],
] as const;

/**
 * Лист схемы (#995): герой — суть схемы и знак её домена (DomainArt), «Как это
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
  const coping = COPING.filter(([key]) => guide.coping[key].trim());
  const modes = guide.modeIds.flatMap((id) => getModeById(id)?.name ?? []);
  const voice = [guide.reparenting, ...(guide.voice ?? [])];
  const interventions = guide.interventions.filter((i) => i.trim());
  const copingList = coping.length > 0 && (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {coping.map(([key, label]) => (
        <div key={key}>
          <dt style={{ ...guideTextStyle, fontWeight: 600 }}>{label}</dt>
          <dd style={{ ...guideTextStyle, margin: 0 }}>{guide.coping[key]}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <GuideSheet
      label="Схема" title={schemaName} lede={guide.essence} voice={voice} view={view} {...actions}
      art={<DomainArt domain={schemaDomain(guide.schemaId)} size="hero" />}
      moreParts={[
        { title: 'Копинг', children: copingList || undefined },
        { title: 'Типичные режимы', text: modes.join(', ') },
        { title: 'Общее для домена', text: domainNote },
      ]}
    >
      <GuideSection title="Потребность" text={guide.need} />
      <GuideSection title="В кабинете" text={guide.inSession} />
      {interventions.length > 0 && (
        <GuideSection title="Что делать">
          <GuidePoints items={interventions} />
        </GuideSection>
      )}
    </GuideSheet>
  );
}
