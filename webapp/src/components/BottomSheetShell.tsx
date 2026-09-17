// Оболочка «лист снизу» (бэкдроп + скруглённая карточка + полоска-хват) —
// единственная копия для webapp (правило «одна механика — один компонент»):
// ShareCardSheet и PhraseHistoryCard заводили её каждый у себя один-в-один.
// goBack — уже посчитанный вызывающим через useHistorySheet (не считаем
// здесь: у каждого владельца свой единственный вызов хука истории).
import type { ReactNode } from 'react';

interface Props {
  goBack: () => void;
  zIndex: number;
  maxWidth?: number;
  padding?: string;
  children: ReactNode;
}

export function BottomSheetShell({
  goBack,
  zIndex,
  maxWidth = 560,
  padding = '24px 24px 40px',
  children,
}: Props) {
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={goBack}
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
          padding,
          width: '100%',
          maxWidth,
          margin: '0 auto',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 'var(--r-2)',
            background: 'var(--surface-3)',
            margin: '0 auto 20px',
          }}
        />
        {children}
      </div>
    </div>
  );
}
