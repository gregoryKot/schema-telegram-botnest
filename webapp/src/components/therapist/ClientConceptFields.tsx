import type { ReactElement } from 'react';
import '../../styles/therapist-concept.css';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { CONCEPT_FIELD_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { CONCEPT_FIELDS } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';
import { ConceptPickers } from './concept/ConceptPickers';
import { ConceptProgress } from './concept/ConceptProgress';
import { ConceptSectionShell, type FieldProps } from './concept/ConceptSectionShell';
import { CONCEPT_SECTIONS, sectionNumber, type ConceptValues } from './concept/conceptSections';
import {
  ConceptEarly, ConceptNeeds, ConceptTriggers, ConceptCoping, ConceptModes, ConceptProblems,
} from './concept/ConceptSectionsText';

// Вид «Поля» вкладки концептуализации: прогресс, схемы и режимы, затем
// нумерованные разделы — у каждого своя форма над СВОИМ полем модели.
// Сохранение прежнее: patchConcept → автосохранение.
const HINTS: Record<string, string> = {
  goals: 'Что должно измениться — конкретные результаты, на которые направлена работа',
  earlyExperience: 'События и паттерны, сформировавшие схемы — по возрастам',
  unmetNeeds: 'Фрустрированные потребности: клик добавляет название в текст',
  triggers: 'Быстрые теги дописываются в текст поля',
  copingStyles: 'Три типа реакции на активацию схемы',
};
const FORMS: Record<string, (p: FieldProps) => ReactElement> = {
  earlyExperience: ConceptEarly,
  unmetNeeds: ConceptNeeds,
  triggers: ConceptTriggers,
  copingStyles: ConceptCoping,
  modeTransitions: ConceptModes,
  currentProblems: ConceptProblems,
};

// Единственное поле ввода концептуализации — его берут все формы разделов
// (concept/ConceptSectionsText.tsx); различаются только класс и высота.
// Предел — тот же, что `@MaxLength` сервера (инцидент 2026-10-26: без него
// длинный текст молча не сохранялся и держал остальные поля).
export function ConceptArea({ value, onChange, placeholder, rows = 4, className = 'ds-textarea' }: FieldProps & { rows?: number; className?: string }) {
  return (
    <LimitedTextarea max={CONCEPT_FIELD_TEXT_MAX} className={className} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

function GoalsForm(p: FieldProps) {
  return <ConceptArea {...p} rows={3} />;
}

export function ClientConceptFields({ detail }: { detail: ClientDetail }) {
  const { localConcept, patchConcept } = detail;
  const values = localConcept as ConceptValues;
  const meta = (key: string) => CONCEPT_FIELDS.find((f) => f.key === key);

  return (
    <div className="tcp-fields">
      <ConceptProgress values={values} />
      <ConceptPickers detail={detail} />
      {CONCEPT_SECTIONS.map((s, i) => {
        const m = meta(s.key);
        const Form = FORMS[s.key] ?? GoalsForm;
        return (
          <ConceptSectionShell
            key={s.key}
            id={s.key}
            n={sectionNumber(i)}
            title={m?.label ?? s.title}
            hint={HINTS[s.key]}
          >
            <Form
              value={values[s.key] ?? ''}
              onChange={(v) => patchConcept({ [s.key]: v.slice(0, CONCEPT_FIELD_TEXT_MAX) })} // теги дописываются программно, мимо maxLength
              placeholder={m?.placeholder ?? ''}
            />
          </ConceptSectionShell>
        );
      })}
    </div>
  );
}
