import { api, UserSettings, TherapyRelationInfo } from '../../api';
import { SkeletonLines } from '../Skeleton';
import { SectionHeader } from './ui';
import { TherapistPrivacyToggles } from './TherapistPrivacyToggles';
import { LeaveTherapy } from './LeaveTherapy';
import { useTr } from '../../utils/addressForm';
import { FormerTherapistNote } from '../../../../shared/src/therapy/FormerTherapistNote';
import { useTherapyCodeJoin } from '../../../../shared/src/therapy/useTherapyCodeJoin';
import {
  THERAPY_INVITE_CODE_PLACEHOLDER,
  THERAPY_INVITE_INPUT_MAX,
} from '../../../../shared/src/therapy/inviteCode';
import {
  joinDoneText,
  therapistConnectedTitle,
} from '../../../../shared/src/therapy/therapistLinkCopy';

interface Props {
  therapyRelation: TherapyRelationInfo | null | undefined;
  setTherapyRelation: (v: TherapyRelationInfo | null) => void;
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  onInfo: () => void;
}

// «Мой терапевт» в настройках мини-аппа. Инцидент 2026-10-26: поле пускало 8
// знаков при коде из 12, кнопка звалась «Войти», статус был мужским родом,
// «Отключиться» рвало связь одним тапом (теперь LeaveTherapy.tsx). Подключение
// по коду — общий с сайтом хук (shared/src/therapy/useTherapyCodeJoin.ts),
// пара — webapp TherapistSections.tsx.
const smallText = {
  fontSize: 12,
  color: 'var(--text-faint)',
  lineHeight: 1.6,
} as const;

export function TherapistClientSection({
  therapyRelation,
  setTherapyRelation,
  settings,
  patch,
  onInfo,
}: Props) {
  const tr = useTr();
  const join = useTherapyCodeJoin(api, setTherapyRelation);
  return (
    <div className="u-mb8">
      <SectionHeader onInfo={onInfo}>МОЙ ТЕРАПЕВТ</SectionHeader>
      <div
        className="card"
        style={{ borderRadius: 'var(--r-16)', padding: 16 }}
      >
        {therapyRelation === undefined ? (
          <div style={{ padding: '8px 0' }}>
            <SkeletonLines widths={['80%', '60%']} />
          </div>
        ) : therapyRelation?.status === 'active' ? (
          <div>
            <div
              style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12 }}
            >
              {therapistConnectedTitle(therapyRelation.partnerName)}
            </div>
            {join.joined && (
              <div
                role="status"
                style={{
                  ...smallText,
                  color: 'var(--text-sub)',
                  marginBottom: 12,
                }}
              >
                {joinDoneText(therapyRelation.partnerName, tr)}
              </div>
            )}

            {/* Privacy toggles */}
            <TherapistPrivacyToggles settings={settings} patch={patch} />
            <div style={{ ...smallText, fontSize: 11, marginBottom: 12 }}>
              Трекер потребностей и задания терапевт всегда видит
            </div>

            <LeaveTherapy onLeft={() => setTherapyRelation(null)} />
          </div>
        ) : (
          <div>
            {/* Терапевт отказался от роли — сообщение над формой кода. */}
            <FormerTherapistNote
              load={api.getFormerTherapist}
              enabled={therapyRelation === null}
              className="u-mb12"
            />
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 10,
              }}
            >
              {tr(
                'Если терапевт дал код или ссылку — вставь сюда',
                'Если терапевт дал код или ссылку — вставьте сюда',
              )}
            </div>
            <div style={{ ...smallText, marginBottom: 10 }}>
              Ввод кода — это согласие открыть терапевту доступ к своим записям:
              дневникам, заметкам и результатам опросников (объём настраивается
              после подключения, отключить терапевта можно в любой момент).
            </div>
            <div className="u-row8">
              <input
                value={join.code}
                onChange={(e) => join.setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void join.submit()}
                aria-label="Код от терапевта"
                placeholder={THERAPY_INVITE_CODE_PLACEHOLDER}
                maxLength={THERAPY_INVITE_INPUT_MAX}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: `1px solid ${join.error ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                  borderRadius: 'var(--r-10)',
                  padding: '9px 12px',
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
              <button
                onClick={() => void join.submit()}
                disabled={join.busy}
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
                {join.busy ? 'Подключаю…' : 'Подключиться'}
              </button>
            </div>
            {join.error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  marginTop: 6,
                }}
              >
                {join.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
