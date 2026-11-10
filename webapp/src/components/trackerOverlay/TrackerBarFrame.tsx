import type { ReactNode } from 'react';

/**
 * Каркас верхней полосы трекера: «Закрыть» слева, слот точек, слот справа. Один на вопрос
 * (TrackerTopbar) и его силуэт загрузки (QuestionSkeleton): полоса меняется в одном месте, и
 * силуэт не прыгает, когда приходят данные. С `label` точки — группа кнопок, без — декор силуэта.
 */
export function TrackerBarFrame({ onClose, label, children, end }: {
  onClose: () => void;
  label?: string;
  children: ReactNode;
  end?: ReactNode;
}) {
  const dots = label ? { role: 'group', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <div className="tq-bar">
      <button type="button" className="tq-bar-btn" onClick={onClose}>Закрыть</button>
      <div className="tq-dots" {...dots}>{children}</div>
      {end ?? <span />}
    </div>
  );
}
