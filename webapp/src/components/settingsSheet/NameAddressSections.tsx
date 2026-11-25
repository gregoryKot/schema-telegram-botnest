import { useState } from 'react';
import { api, type UserSettings } from '../../api';
import { useSetAddressForm, useTr } from '../../utils/addressForm';
import { SSection } from './ui';
import { stepTab } from '../lineTabsModel';

interface NameProps {
  value: string; onChange: (v: string) => void; displayName?: string | null; onNameChanged?: (name: string) => void; onSaved: () => void;
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
          <button className="ds-btn ds-btn--sm" disabled={saving || !value.trim()} onClick={save}>{saving ? '...' : 'Сохранить'}</button>
        )}
      </div>
      {error && <div role="alert" className="st-err">Не удалось сохранить имя</div>}
    </SSection>
  );
}

// Раздел «Обращение» (ты/вы).
const FORMS = ['ty', 'vy'] as const;
export function AddressSection({ settings, patch }: { settings: UserSettings; patch: (u: Partial<UserSettings>) => Promise<boolean> }) {
  const setAddressForm = useSetAddressForm();
  const cur = settings.addressForm ?? 'ty';
  // Форма ставится сразу (интерфейс говорит по-новому без ожидания), а на отказе откатывается: patch возвращает исход.
  const pick = (form: typeof FORMS[number]) => {
    setAddressForm(form);
    void patch({ addressForm: form }).then((ok) => { if (!ok) setAddressForm(cur); });
  };
  const onKey = (e: React.KeyboardEvent<HTMLElement>) => { // радиогруппа: ←/→ выбирают соседний вариант, фокус идёт за выбором
    const next = stepTab(FORMS, cur, e.key);
    if (!next) return;
    e.preventDefault(); pick(next);
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-form="${next}"]`)?.focus();
  };
  return (
    <SSection id="s-address" label="Обращение">
      {/* Выбор значения, а не раздел: варианты текстом на линии, у выбранного — черта акцента (как вкладки), без коробок и галки. */}
      <div className="st-pick" role="radiogroup" aria-label="Обращение">
        {FORMS.map(form => (
          <button key={form} type="button" role="radio" className="st-pick-opt" data-form={form} aria-checked={cur === form}
            tabIndex={cur === form ? 0 : -1} onClick={() => pick(form)} onKeyDown={onKey}>{form === 'ty' ? 'На «ты»' : 'На «вы»'}</button>
        ))}
      </div>
    </SSection>
  );
}
