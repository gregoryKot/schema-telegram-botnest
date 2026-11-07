import { getModeById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSection } from './GuideSection';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';
import { guideListStyle, guideTextStyle } from './guideStyles';

type Props = GuideSheetActions & { schemaName: string; view: SchemaGuideView };

// Три стиля копинга — порядок справочника; пустая строка не показывается.
const COPING = [
  ['surrender', 'Капитуляция'],
  ['avoidance', 'Избегание'],
  ['overcompensation', 'Гиперкомпенсация'],
] as const;

/**
 * Лист схемы (#995): весь раздел справочника про схему — суть, потребность,
 * копинг тремя стилями, типичные режимы (названия из реестра режимов; id без
 * режима пропускается), общее для домена, как схема видна в кабинете, фраза
 * репарентинга (реплика терапевта: кавычки и курсив ставит лист, в данных их
 * нет), интервенции, затем общий хвост листа раздела (GuideSheet): техники
 * «На сессии», задания «Между сессиями», где застревают и источники. Пустой
 * раздел не рисуется. Открывается «Подробнее о схеме» на плашке «Обычно в методе».
 */
export function SchemaGuideSheet({ schemaName, view, ...actions }: Props) {
  const { guide, domainNote } = view;
  const coping = COPING.filter(([key]) => guide.coping[key].trim());
  const modes = guide.modeIds.flatMap((id) => getModeById(id)?.name ?? []);
  const reparenting = guide.reparenting.trim();
  const interventions = guide.interventions.filter((i) => i.trim());
  return (
    <GuideSheet
      title={schemaName} view={view} {...actions}
      intro="Как работают со схемой в схема-терапии: откуда она, как проявляется, работа на сессии и задания между сессиями. Метки в квадратных скобках — книги из «Источников»."
    >
      <GuideSection title="Суть" text={guide.essence} />
      <GuideSection title="Потребность" text={guide.need} />
      {coping.length > 0 && (
        <GuideSection title="Копинг">
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {coping.map(([key, label]) => (
              <div key={key}>
                <dt style={{ ...guideTextStyle, fontWeight: 600 }}>{label}</dt>
                <dd style={{ ...guideTextStyle, margin: 0 }}>{guide.coping[key]}</dd>
              </div>
            ))}
          </dl>
        </GuideSection>
      )}
      <GuideSection title="Типичные режимы" text={modes.join(', ')} />
      <GuideSection title="Общее для домена" text={domainNote} />
      <GuideSection title="В кабинете" text={guide.inSession} />
      {reparenting && (
        <GuideSection title="Фраза репарентинга">
          <blockquote style={{ ...guideTextStyle, margin: 0, fontStyle: 'italic' }}>«{reparenting}»</blockquote>
        </GuideSection>
      )}
      {interventions.length > 0 && (
        <GuideSection title="Интервенции">
          <ul style={guideListStyle}>
            {interventions.map((text, i) => <li key={i}>{text}</li>)}
          </ul>
        </GuideSection>
      )}
    </GuideSheet>
  );
}
