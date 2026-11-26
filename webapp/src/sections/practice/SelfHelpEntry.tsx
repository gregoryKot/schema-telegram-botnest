import { useState } from 'react';
import { SignArt } from '../../components/art/SignArt';
import { SelfHelpSheet } from './SelfHelpSheet';
import '../../styles/practice-selfhelp.css';

/**
 * Тихая ссылка «Важное о самопомощи» в шапке «Практик» вместе с листом, который она открывает.
 * Знак — Limits (рамка метода: самопомощь работает в своих границах, PAPER_2026-11.md), а не ⚠:
 * треугольник читался ошибкой у спокойного текста. Состояние здесь, чтобы шапка не разрасталась.
 */
export function SelfHelpEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ds-link cp-selfhelp" onClick={() => setOpen(true)}>
        <span className="cp-selfhelp-sign" aria-hidden="true"><SignArt sign="limits" size="nav" /></span>
        Важное о самопомощи
      </button>
      {open && <SelfHelpSheet onClose={() => setOpen(false)} />}
    </>
  );
}
