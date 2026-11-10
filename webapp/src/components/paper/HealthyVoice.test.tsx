// @vitest-environment jsdom
// Голос Здорового Взрослого — одна вставка на ленту и мастер режимов (ревью g3): бумага и знак группы
// «здоровые» из modeGroupLook, подпись и текст; пример — отдельным модификатором.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HealthyVoice } from './HealthyVoice';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';

afterEach(cleanup);

describe('HealthyVoice', () => {
  it('бумага и знак группы «здоровые», подпись и текст', () => {
    const { container } = render(<HealthyVoice label="Здоровый взгляд" text="Я справлюсь." className="cd-field" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('pp-paper pa-voice cd-field');
    expect(root.style.getPropertyValue('--h')).toBe(String(modeGroupLook('healthy').hue));
    expect(root.querySelector('.pa-voice-sign svg')).not.toBeNull();
    expect(root.querySelector('.pa-voice-label')?.textContent).toBe('Здоровый взгляд');
    expect(root.querySelector('.pa-voice-text')?.textContent).toBe('Я справлюсь.');
  });

  it('пример — модификатор pa-voice--example', () => {
    const { container } = render(<HealthyVoice label="Например" text="…" example />);
    expect(container.firstElementChild?.classList.contains('pa-voice--example')).toBe(true);
  });
});
