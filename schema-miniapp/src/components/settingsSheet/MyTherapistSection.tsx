// Секция «Мой терапевт» (CLIENT-view): статус связи, приватность, отвязка,
// вход по коду. Вынесено из SettingsSheet.tsx.
import { api } from '../../api';
import type { UserSettings, TherapyRelationInfo } from '../../api';
import { SectionHeader } from './primitives';

export function MyTherapistSection({
  therapyRelation,
  setTherapyRelation,
  settings,
  patch,
  therapyJoinCode,
  setTherapyJoinCode,
  therapyJoinError,
  setTherapyJoinError,
  onInfo,
}: {
  therapyRelation: TherapyRelationInfo | null | undefined;
  setTherapyRelation: (v: TherapyRelationInfo | null) => void;
  settings: UserSettings;
  patch: (u: Partial<UserSettings>) => Promise<void>;
  therapyJoinCode: string;
  setTherapyJoinCode: (v: string) => void;
  therapyJoinError: string;
  setTherapyJoinError: (v: string) => void;
  onInfo: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SectionHeader onInfo={() => onInfo()}>МОЙ ТЕРАПЕВТ</SectionHeader>
      <div className="card" style={{ borderRadius: 16, padding: 16 }}>
        {therapyRelation === undefined ? (
          <div
            style={{
              color: 'var(--text-sub)',
              fontSize: 13,
              textAlign: 'center',
              padding: '8px 0',
            }}
          >
            Загрузка...
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
              👨‍⚕️ {therapyRelation.partnerName ?? 'Терапевт'} подключён
            </div>

            {/* Privacy toggles */}
            <div
              style={{
                marginBottom: 12,
                background: 'rgba(var(--fg-rgb),0.04)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text)',
                      fontWeight: 500,
                    }}
                  >
                    Карточки схем и режимов
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    Личные карточки и заметки
                  </div>
                </div>
                <div
                  onClick={() =>
                    patch({
                      therapistShareCards: !settings.therapistShareCards,
                    })
                  }
                  role="switch"
                  aria-checked={!!settings.therapistShareCards}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void patch({
                        therapistShareCards: !settings.therapistShareCards,
                      });
                    }
                  }}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: settings.therapistShareCards
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.15)',
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
                      left: settings.therapistShareCards ? 20 : 2,
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
              <div
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text)',
                      fontWeight: 500,
                    }}
                  >
                    Профиль и схемы
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    Активные схемы и результаты теста
                  </div>
                </div>
                <div
                  onClick={() =>
                    patch({
                      therapistShareProfile: !settings.therapistShareProfile,
                    })
                  }
                  role="switch"
                  aria-checked={!!settings.therapistShareProfile}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void patch({
                        therapistShareProfile: !settings.therapistShareProfile,
                      });
                    }
                  }}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: settings.therapistShareProfile
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.15)',
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
                      left: settings.therapistShareProfile ? 20 : 2,
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
            </div>
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
                  .catch(() => {});
              }}
              style={{
                background:
                  'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
                borderRadius: 10,
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
              Если терапевт дал код — введи его здесь
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
            <div style={{ display: 'flex', gap: 8 }}>
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
                  borderRadius: 10,
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
                  borderRadius: 10,
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
