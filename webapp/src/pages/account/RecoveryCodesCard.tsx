import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { CopyFailedHint } from '../../../../shared/src/components/CopyFailedHint';
import { OkMark } from './OkMark';

// Резервные коды сразу после включения двухфакторной защиты — показываются
// один раз. Вынесено из TwoFactorSection.tsx (правило №10). QA 2026-11 (М7):
// жаргон «Recovery-коды», «вместо TOTP-кода» заменён словами, а коды можно
// скопировать одной кнопкой, а не выделять по одному.
export function RecoveryCodesCard({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const tr = useTr();
  const copy = useCopyToClipboard({ resetMs: 2500 });
  return (
    <section className="aa-group aa-tfa">
      <div className="aa-group-head"><h2 className="ds-h3">Резервные коды</h2></div>
      <div className="aa-small">
        {tr(
          'Сохрани эти коды в надёжном месте, например в менеджере паролей. Каждый подходит один раз вместо кода из приложения, если потеряешь телефон.',
          'Сохраните эти коды в надёжном месте, например в менеджере паролей. Каждый подходит один раз вместо кода из приложения, если потеряете телефон.',
        )}
      </div>
      <div className="aa-codes">
        {codes.map(c => <div key={c}>{c}</div>)}
      </div>
      <div className="aa-actions">
        <button onClick={() => void copy.copy(codes.join('\n'))} className="ds-btn ds-btn--secondary">
          {copy.copied ? <><OkMark />Скопировано</> : 'Скопировать коды'}
        </button>
        <button onClick={onDone} className="ds-btn ds-btn--secondary">
          Готово, коды сохранены
        </button>
      </div>
      <CopyFailedHint show={copy.failed} tr={tr} />
    </section>
  );
}
