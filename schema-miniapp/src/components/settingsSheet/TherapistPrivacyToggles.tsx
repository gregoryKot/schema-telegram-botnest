import { UserSettings } from '../../api';
import {
  SHARE_CARDS_TOGGLE,
  SHARE_PROFILE_TOGGLE,
} from '../../../../shared/src/therapy/therapistLinkCopy';

interface Props {
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
}

type ShareKey = 'therapistShareCards' | 'therapistShareProfile';

// Тумблеры раздела «Мой терапевт». Названия и подписи — общие с сайтом
// (therapistLinkCopy): ровно то, что каждый тумблер закрывает на сервере.
export function TherapistPrivacyToggles({ settings, patch }: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        background: 'rgba(var(--fg-rgb),0.04)',
        borderRadius: 'var(--r-12)',
        overflow: 'hidden',
      }}
    >
      <ToggleRow
        copy={SHARE_CARDS_TOGGLE}
        field="therapistShareCards"
        settings={settings}
        patch={patch}
        divider
      />
      <ToggleRow
        copy={SHARE_PROFILE_TOGGLE}
        field="therapistShareProfile"
        settings={settings}
        patch={patch}
      />
    </div>
  );
}

function ToggleRow({
  copy,
  field,
  settings,
  patch,
  divider,
}: Props & {
  copy: { title: string; sub: string };
  field: ShareKey;
  divider?: boolean;
}) {
  const on = !!settings[field];
  const toggle = () => patch({ [field]: !settings[field] });
  return (
    <div
      style={{
        padding: '11px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: divider
          ? '1px solid rgba(var(--fg-rgb),0.06)'
          : undefined,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
          {copy.title}
        </div>
        <div className="u-sub11-mt1">{copy.sub}</div>
      </div>
      <div
        onClick={() => void toggle()}
        role="switch"
        aria-checked={on}
        aria-label={copy.title}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void toggle();
          }
        }}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.15)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--bg)',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  );
}
