import { useState } from 'react';
import { ShareIcon } from '../share/ShareIcon';

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
// Вид (редизайн 2026-11, b16): две тихие пилюли без эмодзи и глифов ▾ — шеврон и
// значок шаринга рисунком; классы ss-topbar* — webapp/src/styles/schema-library.css.
export function YsqResultTopBar({ tr, onShare, onHelpOpen }: Props) {
  const [open, setOpen] = useState(false);

  const toggleHelp = () => {
    if (!open) onHelpOpen();
    setOpen((v) => !v);
  };

  const para = (title: string, text: string, last = false) => (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div className="ss-help-title">{title}</div>
      <div className="u-sub13-lh16">{text}</div>
    </div>
  );

  return (
    <div className="ss-topbar">
      <div className="ss-topbar-row">
        <button
          onClick={toggleHelp}
          aria-expanded={open}
          className="ss-topbar-btn"
        >
          Как понимать
          <svg
            className={`ss-topbar-chev${open ? ' is-open' : ''}`}
            viewBox="0 0 12 12"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4 L6 8 L10 4" />
          </svg>
        </button>
        <button onClick={onShare} className="ss-topbar-btn">
          <ShareIcon /> Поделиться
        </button>
      </div>

      {open && (
        <div className="ss-help">
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
