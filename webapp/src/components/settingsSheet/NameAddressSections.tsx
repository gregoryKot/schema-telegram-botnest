import { useState } from 'react';
import { api, type UserSettings } from '../../api';
import { useSetAddressForm, useTr } from '../../utils/addressForm';
import { SignChip } from '../paper/SignChip';
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
        <input className="ds-input" aria-label="Имя" value={value} onChange={e => onChange(e.target.value)}
          placeholder={tr('Твоё имя', 'Ваше имя')} maxLength={50} />
        {value !== (displayName ?? '') && (
          <button className="ds-btn ds-btn--sm" disabled={saving || !value.trim()} onClick={save}>
            {saving ? '...' : 'Сохранить'}
          </button>
        )}
      </div>
      {error && <div role="alert" className="st-err">Не удалось сохранить имя</div>}
    </SSection>
  );
}

// Раздел «Обращение» (ты/вы).
export function AddressSection({ settings, patch }: { settings: UserSettings; patch: (u: Partial<UserSettings>) => Promise<boolean> }) {
  const setAddressForm = useSetAddressForm();
  return (
    <SSection id="s-address" label="Обращение">
      <div className="st-body-block">
        {/* Выбор значения, а не раздел — чипы-радио, как цель в днях у задачи. */}
        <div className="st-chips" role="radiogroup" aria-label="Обращение">
          {(['ty', 'vy'] as const).map(form => (
            <SignChip key={form} radio label={form === 'ty' ? 'На «ты»' : 'На «вы»'}
              on={(settings.addressForm ?? 'ty') === form}
              onToggle={() => {
                // Форма ставится сразу (интерфейс говорит по-новому без ожидания), а на
                // отказе откатывается вместе с переключателем: patch возвращает исход.
                const prev = settings.addressForm ?? 'ty';
                setAddressForm(form);
                void patch({ addressForm: form }).then((ok) => { if (!ok) setAddressForm(prev); });
              }}
            />
          ))}
        </div>
      </div>
    </SSection>
  );
}
