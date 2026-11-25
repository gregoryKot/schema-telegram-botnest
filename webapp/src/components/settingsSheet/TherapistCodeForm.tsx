import type { TherapyCodeJoin } from '../../../../shared/src/therapy/useTherapyCodeJoin';
import { THERAPY_INVITE_CODE_PLACEHOLDER, THERAPY_INVITE_INPUT_MAX } from '../../../../shared/src/therapy/inviteCode';
import { useTr } from '../../utils/addressForm';
import '../../styles/sheet-settings.css';

/** Ввод кода от терапевта: одна форма на «Настройки → Мой терапевт» и лист «Поговорить с кем-то». */
export function TherapistCodeForm({ join }: { join: TherapyCodeJoin }) {
  const tr = useTr();
  return (
    <>
      <p className="st-text">
        {tr('Код или ссылку от терапевта вставь в поле ниже.', 'Код или ссылку от терапевта вставьте в поле ниже.')}
      </p>
      <p className="st-text st-text--faint">
        Ввод кода — это согласие открыть терапевту доступ к своим записям:
        дневникам, заметкам и результатам опросников (объём настраивается после
        подключения, отключить терапевта можно в любой момент).
      </p>
      <div className="st-actions">
        <input className={`ds-input st-grow st-code${join.error ? ' st-input-err' : ''}`}
          aria-label="Код от терапевта"
          value={join.code} onChange={e => join.setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void join.submit()}
          placeholder={THERAPY_INVITE_CODE_PLACEHOLDER} maxLength={THERAPY_INVITE_INPUT_MAX}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <button type="button" className="ds-link st-act st-go" onClick={() => void join.submit()} disabled={!join.canSubmit}>
          {join.busy ? 'Подключаю…' : 'Подключиться'}
        </button>
      </div>
      {join.error && <div className="st-err">{join.error}</div>}
    </>
  );
}
