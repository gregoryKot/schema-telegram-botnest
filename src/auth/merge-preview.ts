// Что покажет экран `/account/merge` до подтверждения. Имя чужого аккаунта и
// счётчики раньше ехали в query редиректа OAuth (история браузера, логи прокси,
// страница верила адресу). Теперь в адресе только токен, провайдер и флаг 2FA,
// остальное отдаёт сервер, сам проверив токен и того, кто спрашивает.
import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { decryptAuthProviderRow } from '../utils/auth-provider-crypto';
import type { AuthService } from './auth.service';
import type { MergeService } from './merge.service';

export interface MergePreview {
  provider: string;
  /** Имя или почта поглощаемого аккаунта у этого провайдера; null — нет. */
  otherDisplay: string | null;
  summary: Record<string, number>;
  /** Сколько записей объединится с записями текущего аккаунта (R3). */
  combined: number;
  twoFactorLost: boolean;
}

export interface MergePreviewDeps {
  auth: Pick<AuthService, 'verifyMergeToken'>;
  merge: Pick<MergeService, 'summarize'>;
  prisma: PrismaService;
}

export async function buildMergePreview(
  deps: MergePreviewDeps,
  token: string,
  callerId: bigint,
): Promise<MergePreview> {
  const { target, source, provider, providerId } =
    deps.auth.verifyMergeToken(token);
  // Токен выписан на объединение В аккаунт вызывающего — чужой не читаем.
  if (target !== callerId) {
    throw new ForbiddenException('Merge token does not match current session');
  }
  const [row, s] = await Promise.all([
    deps.prisma.authProvider.findUnique({
      where: { provider_providerId: { provider, providerId } },
      select: { userId: true, displayName: true, email: true },
    }),
    deps.merge.summarize(source, target),
  ]);
  // Строка уже не у source (переехала после выдачи токена) — имя не наше.
  const plain =
    row && row.userId === source ? decryptAuthProviderRow(row) : null;
  return {
    provider,
    otherDisplay: plain?.displayName ?? plain?.email ?? null,
    summary: s.counts,
    combined: s.combined,
    twoFactorLost: s.twoFactorLost,
  };
}
