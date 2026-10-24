// D-9 (аудит 2026-10): AuthProvider.displayName лежит шифротекстом, а экран
// предпросмотра показывает его человеку — читатель обязан пройти через
// decryptAuthProviderRow, иначе на экране сверки окажется абракадабра.
jest.mock('../../utils/auth-provider-crypto', () => ({
  decryptAuthProviderRow: <T extends { displayName?: string | null }>(
    row: T,
  ): T => ({ ...row, displayName: `РАСШИФРОВАНО:${row.displayName}` }),
  encryptAuthProviderFields: <T>(d: T): T => d,
}));

import { makeDeps, startLink, WEB_USER } from './login-ticket.harness.spec';

describe('TicketLinkService.preview — имя провайдера расшифровывается', () => {
  it('displayName идёт через decryptAuthProviderRow', async () => {
    const { links, tickets } = makeDeps();
    const { userCode } = await startLink(tickets);
    const preview = await links.preview(userCode, WEB_USER);
    expect(preview.displayName).toBe('РАСШИФРОВАНО:Гриша');
  });
});
