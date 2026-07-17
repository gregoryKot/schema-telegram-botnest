import type { ClientConceptualization } from '../../api';
import { CONCEPT_FIELDS } from './conceptFields';

interface Props {
  localConcept: Partial<ClientConceptualization>;
  patchConcept: (patch: Partial<ClientConceptualization>) => void;
}

export function ConceptFieldsForm({ localConcept, patchConcept }: Props) {
  return (
    <div style={{ marginTop: 8 }}>
      {CONCEPT_FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: 'var(--text-sub)',
              textTransform: 'uppercase',
              marginBottom: 5,
            }}
          >
            {label}
          </div>
          <textarea
            value={(localConcept[key] as string) ?? ''}
            onChange={(e) => patchConcept({ [key]: e.target.value })}
            placeholder={placeholder}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(var(--fg-rgb),0.04)',
              border: '1px solid rgba(var(--fg-rgb),0.08)',
              borderRadius: 12,
              padding: '10px 12px',
              outline: 'none',
              resize: 'none',
              color: 'var(--text)',
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
        </div>
      ))}
    </div>
  );
}
