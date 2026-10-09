import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Схемы"
      eyebrowColor="var(--accent)"
      title={<>Мои<br /><span className="it">схемы</span></>}
      lede={tr('Выбери схемы, которые тебе близки. Можно без теста – если ты уже знаешь свои. Выбор сохраняется сразу.', 'Выберите схемы, которые вам близки. Можно без теста – если вы уже знаете свои. Выбор сохраняется сразу.')}
    >
      {SCHEMA_DOMAINS.map(domain => (
        <div key={domain.id} className="u-mb28">
          <div className="chip-section-eyebrow" style={{ color: domain.color }}>
            <span className="dot" style={{ background: domain.color }} />
            {domain.domain}
          </div>
          <div className="u-col6">
            {domain.schemas.map(s => {
              const active = ids.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.id); } }}
                  className={'mode-card ' + (active ? 'is-selected' : '')}
                  style={{ '--mode-color': domain.color } as React.CSSProperties}
                >
                  <span className="mode-card-stripe" />
                  <div className="u-fill">
                    <div className="mode-card-name">{s.name}</div>
                    {s.desc && (
                      <div className="mode-card-short">{s.desc}</div>
                    )}
                  </div>
                  {active && <span className="mode-check"><GlyphCheck /></span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="ex-foot">
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          onClick={goBack}
        >
          Готово
        </button>
      </div>
    </ExScreen>
  );
}
