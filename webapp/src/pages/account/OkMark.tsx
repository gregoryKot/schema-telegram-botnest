/** Галочка статуса («Включена», «Email успешно привязан») — рисунком, не глифом ✓ (APP_2026-11.md, принцип 7). */
export function OkMark() {
  return (
    <svg className="aa-ok-mark" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
