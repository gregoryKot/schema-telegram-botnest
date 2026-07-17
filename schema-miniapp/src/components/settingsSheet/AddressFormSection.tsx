import { UserSettings } from '../../api';
import { SettingsLabel } from './primitives';

export function AddressFormSection({
  settings,
  patch,
  setAddressForm,
}: {
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  setAddressForm: (form: 'ty' | 'vy') => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ОБРАЩЕНИЕ</SettingsLabel>
      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: '10px 12px',
          display: 'flex',
          gap: 8,
        }}
      >
        {(['ty', 'vy'] as const).map((form) => {
          const active = (settings.addressForm ?? 'ty') === form;
          return (
            <div
              key={form}
              onClick={() => {
                setAddressForm(form);
                void patch({ addressForm: form });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setAddressForm(form);
                  void patch({ addressForm: form });
                }
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                textAlign: 'center',
                background: active
                  ? 'var(--accent)'
                  : 'rgba(var(--fg-rgb),0.06)',
                color: active ? '#fff' : 'var(--text-sub)',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {form === 'ty' ? 'На «ты»' : 'На «вы»'}
            </div>
          );
        })}
      </div>
    </div>
  );
}
