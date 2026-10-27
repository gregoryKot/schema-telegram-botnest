import { useState } from 'react';
import { haptic } from '../../../haptic';
import { CrisisCard } from '../../CrisisCard';
import { SchemaChipsStep } from '../SchemaChipsStep';

/** Второй экран тега «Схема»: какая схема сработала. «Пропустить» сохраняет запись без схемы. */
export function QuickSchemaStep({ activeSchemaIds, saving, crisis, onBack, onSave }: {
  activeSchemaIds?: string[];
  saving: boolean;
  crisis: boolean;
  onBack: () => void;
  onSave: (schemaIds: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const toggle = (id: string) => {
    haptic.select();
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  return (
    <>
      <div className="tq-bar">
        <button type="button" className="tq-bar-btn" onClick={onBack}>Назад</button>
        <span className="ds-eyebrow qe-bar-title">Дневник</span>
        <span />
      </div>
      <div className="tq-body">
        <div className="tq-inner">
          <h1 className="tq-title">Какая схема сработала?</h1>
          <p className="tq-hint">Можно выбрать несколько или пропустить — запись останется.</p>
          {crisis && <CrisisCard surface="schema" />}
          <SchemaChipsStep
            schemaIds={ids}
            onToggle={toggle}
            activeSchemaIds={activeSchemaIds}
            showAllSchemas={showAll}
            onToggleShowAll={() => { haptic.tap(); setShowAll((v) => !v); }}
          />
          <div className="tq-acts">
            <button type="button" className="ds-btn qe-cta" disabled={ids.length === 0 || saving} onClick={() => onSave(ids)}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" className="tq-btn" disabled={saving} onClick={() => onSave([])}>Пропустить</button>
          </div>
        </div>
      </div>
    </>
  );
}
