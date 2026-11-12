// @vitest-environment jsdom
// Один ввод кода (b27): код второго аккаунта — те же OtpCells, что на входе с 2FA и в окне кода,
// резервный код — RecoveryCodeField по переключателю. Автозаполнение кода приложения не теряется.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SourceTotpField } from './SourceTotpField';

afterEach(cleanup);

function Harness({ onCode = () => {} }: { onCode?: (v: string) => void }) {
  const [code, setCode] = useState('');
  return <SourceTotpField code={code} onChange={(v) => { setCode(v); onCode(v); }} disabled={false} />;
}

describe('SourceTotpField', () => {
  it('код приложения — ячейки с numeric и one-time-code, только цифры', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Код второго аккаунта') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    fireEvent.change(input, { target: { value: ' 123 456 ' } });
    expect(input.value).toBe('123456');
  });

  it('переключатель — поле резервного кода, введённое стирается; и обратно', () => {
    const onCode = vi.fn();
    render(<Harness onCode={onCode} />);
    fireEvent.change(screen.getByLabelText('Код второго аккаунта'), { target: { value: '12' } });
    fireEvent.click(screen.getByText('Использовать резервный код'));
    expect(onCode).toHaveBeenLastCalledWith('');
    const rec = screen.getByLabelText('Резервный код') as HTMLInputElement;
    expect(rec.getAttribute('autocomplete')).toBe('off');
    fireEvent.change(rec, { target: { value: 'AB12 cd34-EF' } });
    expect(rec.value).toBe('ab12cd34ef');
    fireEvent.click(screen.getByText('Ввести код из приложения'));
    expect(screen.getByLabelText('Код второго аккаунта')).toBeTruthy();
  });
});
