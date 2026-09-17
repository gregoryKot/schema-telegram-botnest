import { api, UserSettings, TherapyRelationInfo } from '../../api';
import { SkeletonLines } from '../Skeleton';
import { SectionHeader } from './ui';
import { TherapistPrivacyToggles } from './TherapistPrivacyToggles';
import { useTr } from '../../utils/addressForm';

interface Props {
  therapyRelation: TherapyRelationInfo | null | undefined;
  setTherapyRelation: (v: TherapyRelationInfo | null) => void;
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  therapyJoinCode: string;
  setTherapyJoinCode: (v: string) => void;
  therapyJoinError: string;
  setTherapyJoinError: (v: string) => void;
  onInfo: () => void;
}

export function TherapistClientSection({
  therapyRelation,
  setTherapyRelation,
  settings,
  patch,
  therapyJoinCode,
  setTherapyJoinCode,
  therapyJoinError,
  setTherapyJoinError,
  onInfo,
}: Props) {
  const tr = useTr();
  return (
    <div style={{ marginBottom: 8 }}>
      <SectionHeader onInfo={onInfo}>МОЙ ТЕРАПЕВТ</SectionHeader>
      <div
        className="card"
        style={{ borderRadius: 'var(--r-16)', padding: 16 }}
      >
        {therapyRelation === undefined ? (
          <div
            style={{
              color: 'var(--text-sub)',
              fontSize: 13,
              textAlign: 'center',
              padding: '8px 0',
            }}
          >
            <SkeletonLines widths={['80%', '60%']} />
          </div>
        ) : therapyRelation?.status === 'active' ? (
          <div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text)',
                marginBottom: 12,
              }}
            >
              {therapyRelation.partnerName ?? 'Терапевт'} подключён
            </div>

            {/* Privacy toggles */}
            <TherapistPrivacyToggles settings={settings} patch={patch} />
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              Трекер потребностей и задания терапевт всегда видит
            </div>

            <button
              onClick={() => {
                api
                  .leaveTherapy()
                  .then(() => setTherapyRelation(null))
                  .catch((e) => console.error('leaveTherapy failed', e));
              }}
              style={{
                background:
                  'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
                borderRadius: 'var(--r-10)',
                padding: '8px 16px',
                color: 'var(--accent-red)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Отключиться
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 10,
              }}
            >
              {tr(
                'Если терапевт дал код — введи его здесь',
                'Если терапевт дал код — введите его здесь',
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                marginBottom: 10,
                lineHeight: 1.6,
              }}
            >
              Ввод кода — это согласие открыть терапевту доступ к своим записям:
              дневникам, заметкам и результатам опросников (объём настраивается
              после подключения, отключить терапевта можно в любой момент).
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
              <input
                value={therapyJoinCode}
                onChange={(e) =>
                  setTherapyJoinCode(e.target.value.toUpperCase())
                }
                placeholder="ABCDEF"
                maxLength={8}
                style={{
                  flex: 1,
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: `1px solid ${therapyJoinError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                  borderRadius: 'var(--r-10)',
                  padding: '9px 12px',
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
              <button
                onClick={async () => {
                  if (!therapyJoinCode.trim()) return;
                  setTherapyJoinError('');
                  try {
                    await api.joinTherapy(therapyJoinCode.trim());
                    const rel = await api.getTherapyRelation();
                    setTherapyRelation(rel);
                    setTherapyJoinCode('');
                  } catch {
                    setTherapyJoinError('Неверный код');
                  }
                }}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--r-10)',
                  padding: '9px 16px',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Войти
              </button>
            </div>
            {therapyJoinError && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  marginTop: 6,
                }}
              >
                {therapyJoinError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
