import type { CSSProperties } from 'react';
import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { COPING_STYLES, type CopingStyleId } from '../../../../../shared/src/schemaTherapy/guide/copingStyles';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSection } from './GuideSection';
import { GuidePoints } from './GuidePoints';
import { GuideRelated } from './GuideRelated';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';
import { modeGuideLook, schemaGuideLook } from './guideLook';
import { articleAddress } from './marks/guideMarkModel';

/** «Про клиента» у стиля копинга (#1484): из карточки клиента — его имя у отмеченных стилей. */
export interface SchemaCopingMarks {
  onMark: (style: CopingStyleId) => void;
  clientName?: string;
  marked?: (style: CopingStyleId) => boolean;
}

type Props = GuideSheetActions & { schemaName: string; view: SchemaGuideView; coping?: SchemaCopingMarks; onOpenMode?: (modeId: string) => void };

/**
 * Лист схемы (#995), вариант A: герой со знаком домена (schemaGuideLook), «Как это звучит» — фраза
 * репарентинга (кавычки ставит лист) и реплики `voice`, потребность, техники «На сессии», «В кабинете»,
 * «Что делать» пунктами, «Между сессиями», «Связано» — типичные режимы чипами (id без режима пропускается).
 * Под «Подробнее» — копинг тремя стилями, общее для домена и «Где застревают». Пустой раздел не рисуется.
 */
export function SchemaGuideSheet({ schemaName, view, coping: marks, onOpenMode, ...actions }: Props) {
  const { guide, domainNote } = view;
  const at = articleAddress('schema', guide.schemaId);
  // Три стиля копинга — порядок справочника; пустая строка не показывается.
  const coping = COPING_STYLES.filter((s) => guide.coping[s.id].trim());
  const modes = guide.modeIds.flatMap((id) => { const m = getModeById(id); return m ? [{ id, name: m.name }] : []; });
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
      label="Схема" title={schemaName} lede={guide.essence} voice={[guide.reparenting, ...(guide.voice ?? [])]} view={view} {...actions}
      look={schemaGuideLook(guide.schemaId)} at={at}
      moreParts={[
        { title: 'Копинг', children: copingList || undefined },
        { title: 'Общее для домена', text: domainNote, address: at('domainNote') },
      ]}
      lead={<GuideSection title="Потребность" text={guide.need} address={at('need')} />}
      related={<GuideRelated groups={[{ title: 'Режимы', address: at('modeIds'), items: modes, look: modeGuideLook, onOpen: onOpenMode }]} />}
    >
      <GuideSection title="В кабинете" text={guide.inSession} address={at('inSession')} />
      {interventions.length > 0 && (
        <GuideSection title="Что делать" address={at('interventions')}>
          <GuidePoints items={interventions} />
        </GuideSection>
      )}
    </GuideSheet>
  );
}
