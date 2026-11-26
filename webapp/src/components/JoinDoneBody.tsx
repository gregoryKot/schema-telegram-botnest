import { EntryHead } from './paper/EntryHead';
import { JOIN_DONE_TITLE } from '../../../shared/src/therapy/therapistLinkCopy';

type Look = Parameters<typeof EntryHead>[0]['look'];

/** Содержимое окна после присоединения к терапевту: кто и что теперь видит. */
export function JoinDoneBody({ look, text, onClose }: { look: Look; text: string; onClose: () => void }) {
  return (
    <>
      <EntryHead look={look} title={JOIN_DONE_TITLE} />
      <p className="sk-dialog-text" role="status">{text}</p>
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn" onClick={onClose}>Понятно</button>
      </div>
    </>
  );
}
