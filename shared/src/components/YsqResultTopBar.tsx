import { useState } from 'react';

interface Props {
  /** useTr() вызывающего фронтенда: выбирает вариант обращения по addressForm. */
  tr: (ty: string, vy: string) => string;
  onShare: () => void;
  /** Аналитика первого раскрытия объяснения (ysq_help_open, правило №8). */
  onHelpOpen: () => void;
}

// Верхняя панель экрана результатов теста схем (оба фронтенда, правило №3):
// кнопка «Как понимать» раскрывает заботливое объяснение — что это, что значат
// цифры, про ответы из режима защитника и что разбирать результат лучше с
// терапевтом; рядом — «Поделиться» (переехала сюда из подвала экрана).
export function YsqResultTopBar({ tr, onShare, onHelpOpen }: Props) {
  const [open, setOpen] = useState(false);

  const toggleHelp = () => {
    if (!open) onHelpOpen();
    setOpen((v) => !v);
  };

  const para = (title: string, text: string, last = false) => (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {text}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleHelp}
          aria-expanded={open}
          style={{
            flex: 1,
            minHeight: 44,
            padding: '11px 8px',
            border: 'none',
            borderRadius: 12,
            background: open
              ? 'rgba(var(--fg-rgb),0.1)'
              : 'rgba(var(--fg-rgb),0.06)',
            color: 'var(--text-sub)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          ℹ️ Как понимать {open ? '▴' : '▾'}
        </button>
        <button
          onClick={onShare}
          style={{
            flex: 1,
            minHeight: 44,
            padding: '11px 8px',
            border:
              '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📤 Поделиться
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 10,
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 14,
            padding: '14px 16px',
          }}
        >
          {para(
            'Что это такое',
            'Опросник для самонаблюдения из схема-терапии — не диагноз и не ' +
              'оценка. Схемы — привычные с детства способы чувствовать и ' +
              'защищаться, они есть у каждого.',
          )}
          {para(
            'Что значат цифры',
            'По каждой схеме — средний балл от 1 до 6: насколько её ' +
              `утверждения в среднем ${tr('про тебя', 'про вас')}. От 4 из 6 ` +
              'схема считается выраженной. Ещё учитываются сильные «да» — ' +
              'ответы «5» и «6»: даже нескольких достаточно.',
          )}
          {para(
            'Если внутри отвечал «защитник»',
            'Иногда на вопросы отвечает внутренний защитник — часть, которая ' +
              'привыкла говорить «всё нормально, я справляюсь». Тогда баллы ' +
              'получаются ниже, чем есть на самом деле. Это не ошибка — так ' +
              `тоже видно, как психика ${tr('тебя бережёт', 'вас бережёт')}.`,
          )}
          {para(
            'Разбирать лучше вместе с терапевтом',
            'Результат — не вердикт, а хорошая отправная точка для разговора ' +
              'со специалистом: вместе можно понять, откуда схемы взялись и ' +
              'что с ними делать. Карточкой с результатом легко поделиться — ' +
              'кнопка сверху.',
          )}
          {para(
            'Цифры могут меняться',
            'Настроение и усталость тоже влияют на ответы: при повторном ' +
              'прохождении результат может отличаться — это нормально.',
            true,
          )}
        </div>
      )}
    </div>
  );
}
