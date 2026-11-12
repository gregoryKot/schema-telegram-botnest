import { useNavigate } from 'react-router-dom';
import { PaperOutcome } from '../../components/paper/PaperOutcome';

// Вызов 2FA живёт 5 минут; протухший код не примет, сколько его ни вводи. Исход «подожди или
// устарело» (Cup на соломе) на весь экран: форма кода над «войти заново» сбивала бы.
// Экран до входа: формы обращения ещё нет, поэтому текст безличный.
export function TwoFactorExpired() {
  const navigate = useNavigate();
  return (
    <div className="al-expired" role="alert">
      <PaperOutcome outcome="wait" title="Вход устарел: на ввод кода есть 5 минут."
                    lead="Здесь код уже не подойдёт – нужно войти заново."
                    action={{ label: 'Войти заново', onClick: () => navigate('/login', { replace: true }) }} />
    </div>
  );
}
