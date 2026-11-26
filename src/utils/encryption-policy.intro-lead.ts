// Решения о шифровании модели IntroLead (заявка с формы знакомства). Отдельным
// файлом: encryption-policy.infra.ts под храповиком размера (правило №10).
import { Policy, enc, plain } from './encryption-policy';

export const INTRO_LEAD_FIELD_POLICY: Record<string, Record<string, Policy>> = {
  IntroLead: {
    clientName: enc('src/booking/intro-lead.schema.ts'),
    clientContact: enc('src/booking/intro-lead.schema.ts'),
    message: enc('src/booking/intro-lead.schema.ts'),
    clientChannel: plain(
      'перечисление канала связи (telegram/whatsapp/max/email), не персональные данные',
    ),
    source: plain(
      'страница + referrer при отправке формы — структурная атрибуция лида, не PII',
    ),
  },
};
