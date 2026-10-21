import { useState } from 'react';
import { SelfHelpSheet } from './SelfHelpSheet';
import '../../styles/practice-selfhelp.css';

/**
 * Значок «Важное о самопомощи» рядом с заголовком (как ⚠️ в «Помощи»
 * мини-аппа) вместе с листом, который он открывает. Состояние здесь, чтобы
 * шапка и PracticeSection не разрастались.
 */
export function SelfHelpEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="cp-selfhelp" aria-label="Важное о самопомощи" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
          <path d="M12 10v4.5M12 17.2v.1" />
        </svg>
      </button>
      {open && <SelfHelpSheet onClose={() => setOpen(false)} />}
    </>
  );
}
