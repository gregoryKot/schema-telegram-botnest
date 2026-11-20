import type { CSSProperties } from 'react';
import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { COPING_STYLES, type CopingStyleId } from '../../../../../shared/src/schemaTherapy/guide/copingStyles';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSection } from './GuideSection';
import { GuidePoints } from './GuidePoints';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';
import { schemaGuideLook } from './guideLook';
import { articleAddress } from './marks/guideMarkModel';

/** «Про клиента» у стиля копинга (#1484): из карточки клиента — его имя у отмеченных стилей. */
export interface SchemaCopingMarks {
  onMark: (style: CopingStyleId) => void;
  clientName?: string;
  marked?: (style: CopingStyleId) => boolean;
}

type Props = GuideSheetActions & { schemaName: string; view: SchemaGuideView; coping?: SchemaCopingMarks };

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
export function SchemaGuideSheet({ schemaName, view, coping: marks, ...actions }: Props) {
  const { guide, domainNote } = view;
  const at = articleAddress('schema', guide.schemaId);
  // Три стиля копинга — порядок справочника; пустая строка не показывается.
  const coping = COPING_STYLES.filter((s) => guide.coping[s.id].trim());
  const modes = guide.modeIds.flatMap((id) => getModeById(id)?.name ?? []);
  const voice = [guide.reparenting, ...(guide.voice ?? [])];
  const interventions = guide.interventions.filter((i) => i.trim());
  const copingList = coping.length > 0 && (
    <dl className="gd-coping">
      {coping.map((s) => {
        const on = !!marks?.clientName && !!marks.marked?.(s.id);
        return (
          <div key={s.id} className={on ? 'gd-coping-on' : undefined} style={{ '--gst-c': s.color } as CSSProperties}>
            <dt className="gd-text gd-text--strong">
              {s.label}
              {on && <span className="gd-coping-who"> · отмечено у {marks?.clientName}</span>}
            </dt>
            <dd className="gd-text">
              {guide.coping[s.id]}
              {marks && (
                <button type="button" className="ds-link gd-plan" aria-label={`Про клиента: ${s.label}`} onClick={() => marks.onMark(s.id)}>
                  {on ? 'Изменить или снять' : 'Про клиента'}
                </button>
              )}
            </dd>
          </div>
        );
      })}
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
