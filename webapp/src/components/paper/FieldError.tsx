// Ошибка у поля — один вид на сайт (ревью b26–b28: неверный код на входе с 2FA был листом, в аккаунте и
// окне кода — красной строкой): компактный PaperAlert на соломе строкой под полем, без знака. role=alert —
// сбой случился сейчас; отказ по заявке и прочие «уже известно» — role=status.
import type { ReactNode } from 'react';
import { PaperAlert } from './PaperAlert';

export function FieldError({ children, role = 'alert', className }: {
  children: ReactNode; role?: 'alert' | 'status'; className?: string;
}) {
  return <PaperAlert title={children} role={role} className={className ? `pa-alert--field ${className}` : 'pa-alert--field'} />;
}
