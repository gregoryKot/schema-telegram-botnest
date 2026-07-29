// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModePortrait } from './ModePortrait';
import type { ModeCard } from '../../../../shared/src/mode/modeCards';

const CARD: ModeCard = {
  about: 'Крохотный и настоящий: пугается, что его снова оставят одного.',
  triggers: 'Когда никто не отвечает на сообщения весь день',
  body: 'Ком в горле, тяжесть в груди, хочется свернуться',
  voice: '«Меня опять бросят», «я никому не нужен»',
  behavior: 'Замирает, звонит по кругу, ищет подтверждения',
  origin: 'Когда-то рядом правда никого не было — и так выжил',
  cost: 'Пугает партнёра частыми проверками «ты меня не бросишь?»',
  need: 'Надёжного присутствия рядом',
  healthyAdult: 'Я здесь и никуда не денусь прямо сейчас — можно выдохнуть',
};

afterEach(() => {
  cleanup();
});

describe('ModePortrait', () => {
  it('рендерит шапку, описание и все 8 блоков портрета', () => {
    render(
      <ModePortrait
        onClose={() => {}}
        emoji="🥺"
        name="Уязвимый Ребёнок"
        groupName="Детские режимы"
        accentColor="#60a5fa"
        card={CARD}
        explainer="Пояснение зачем это"
        onStart={() => {}}
      />,
    );
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Детские режимы')).toBeTruthy();
    expect(screen.getByText(CARD.about)).toBeTruthy();
    expect(screen.getByText('Пояснение зачем это')).toBeTruthy();

    expect(screen.getByText('Когда включается')).toBeTruthy();
    expect(screen.getByText('Как узнать в теле')).toBeTruthy();
    expect(screen.getByText('Что говорит')).toBeTruthy();
    expect(screen.getByText('Что делает')).toBeTruthy();
    expect(screen.getByText('Зачем появился')).toBeTruthy();
    expect(screen.getByText('Чего стоит сейчас')).toBeTruthy();
    expect(screen.getByText('Что ему на самом деле нужно')).toBeTruthy();
    expect(screen.getByText('Что отвечает Здоровый Взрослый')).toBeTruthy();

    expect(screen.getByText(CARD.triggers)).toBeTruthy();
    expect(screen.getByText(CARD.healthyAdult)).toBeTruthy();
  });

  it('клик по главной кнопке зовёт onStart', () => {
    const onStart = vi.fn();
    render(
      <ModePortrait
        onClose={() => {}}
        emoji="🥺"
        name="Уязвимый Ребёнок"
        groupName="Детские режимы"
        accentColor="#60a5fa"
        card={CARD}
        explainer="Пояснение"
        onStart={onStart}
      />,
    );
    fireEvent.click(screen.getByText('Заполнить свою карточку →'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('ctaLabel переопределяет текст кнопки (честный возврат, не «начало»)', () => {
    render(
      <ModePortrait
        onClose={() => {}}
        emoji="🥺"
        name="Уязвимый Ребёнок"
        groupName="Детские режимы"
        accentColor="#60a5fa"
        card={CARD}
        explainer="Пояснение"
        onStart={() => {}}
        ctaLabel="Назад к вопросам →"
      />,
    );
    expect(screen.getByText('Назад к вопросам →')).toBeTruthy();
    expect(screen.queryByText('Заполнить свою карточку →')).toBeNull();
  });
});
