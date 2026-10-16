import { useState } from 'react';
import { api, type UserSettings } from '../../api';
import { useSetAddressForm, useTr } from '../../utils/addressForm';
import { SSection } from './ui';

interface NameProps {
  value: string;
  onChange: (v: string) => void;
  displayName?: string | null;
  onNameChanged?: (name: string) => void;
  onSaved: () => void;
}

// Раздел «Имя».
export function NameSection({ value, onChange, displayName, onNameChanged, onSaved }: NameProps) {
  const tr = useTr();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false); // отказ раньше не был виден
  async function save() {
    const name = value.trim(); if (!name) return;
    setSaving(true); setError(false);
    try { await api.updateName(name); onNameChanged?.(name); onSaved(); }
    catch { setError(true); } finally { setSaving(false); }
  }
  return (
    <SSection id="s-name" label="Имя">
      <div className="st-row-name">
        <input className="ds-input" value={value} onChange={e => onChange(e.target.value)}
          placeholder={tr('Твоё имя', 'Ваше имя')} maxLength={50} />
        {value !== (displayName ?? '') && (
          <button className="ds-btn ds-btn--sm" disabled={saving || !value.trim()} onClick={save}>
            {saving ? '...' : 'Сохранить'}
          </button>
        )}
      </div>
      {error && <div role="alert" className="st-err">{tr('Не удалось сохранить имя', 'Не удалось сохранить имя')}</div>}
    </SSection>
  );
}

// Раздел «Обращение» (ты/вы).
export function AddressSection({ settings, patch }: { settings: UserSettings; patch: (u: Partial<UserSettings>) => Promise<void> }) {
  const setAddressForm = useSetAddressForm();
  return (
    <SSection id="s-address" label="Обращение">
      <div className="st-body-block">
        <div className="ds-seg">
          {(['ty', 'vy'] as const).map(form => {
            const active = (settings.addressForm ?? 'ty') === form;
            return (
              <button key={form} className={`ds-seg-btn${active ? ' is-active' : ''}`}
                onClick={() => { setAddressForm(form); patch({ addressForm: form }); }}
              >{form === 'ty' ? 'На «ты»' : 'На «вы»'}</button>
            );
          })}
        </div>
      </div>
    </SSection>
  );
}
