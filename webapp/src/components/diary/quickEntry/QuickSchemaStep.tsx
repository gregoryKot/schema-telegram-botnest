import { useState } from 'react';
import { haptic } from '../../../haptic';
import { CrisisCard } from '../../CrisisCard';
import { EntitySheet } from '../../paper/EntitySheet';
import { SchemaChipsStep } from '../SchemaChipsStep';

/**
 * Второй экран тега «Схема»: какая схема сработала. Лист тот же, что на первом шаге, — полосой
 * (compact) и на глине дневника схем с Layers: выбран тег «Схема». Чипы по доменам — SchemaChipsStep
 * (общий с мастером схем). «Пропустить» — тихая ссылка под «Сохранить»: сохраняет запись без схемы.
 */
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
        <span />
        <span />
      </div>
      <div className="tq-body">
        <div className="qe-flow">
          <EntitySheet look="diary_schema" label="Дневник" title="Какая схема сработала?" titleAs="h1" compact
            sub="Можно выбрать несколько или пропустить — запись останется." className="qe-sheet" />
          {crisis && <CrisisCard surface="schema" />}
          <div className="qe-schemas">
            <SchemaChipsStep
              schemaIds={ids}
              onToggle={toggle}
              activeSchemaIds={activeSchemaIds}
              showAllSchemas={showAll}
              onToggleShowAll={() => { haptic.tap(); setShowAll((v) => !v); }}
            />
          </div>
          <div className="qe-acts qe-acts--row">
            <button type="button" className="ds-btn qe-cta" disabled={ids.length === 0 || saving}
              aria-busy={saving || undefined} onClick={() => onSave(ids)}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" className="tq-more qe-more" disabled={saving} onClick={() => onSave([])}>Пропустить</button>
          </div>
        </div>
      </div>
    </>
  );
}
