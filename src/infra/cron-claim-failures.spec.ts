// Память отказов claimRun: оправдывает только недоступность базы. Ошибка
// другого рода означает мёртвый крон — проба cronLeases обязана краснеть.
import {
  isClaimDbOutage,
  lastClaimDbFailureAt,
  noteClaimFailure,
} from './cron-claim-failures';

describe('isClaimDbOutage', () => {
  it.each([
    ["Can't reach database server at 10.0.0.1:5432"],
    ['P1001'],
    ['Server has closed the connection'],
    ['Connection terminated due to connection timeout'],
    ['connect ETIMEDOUT 10.0.0.1:5432'],
    ['timeout exceeded when trying to connect'],
  ])('«%s» — база недоступна', (message) => {
    expect(isClaimDbOutage(new Error(message))).toBe(true);
  });

  it.each([
    ['relation "CronLease" does not exist'],
    ['column "instanceId" does not exist'],
    ['syntax error at or near "ON"'],
  ])('контроль: «%s» — не авария базы, а сломанный крон', (message) => {
    expect(isClaimDbOutage(new Error(message))).toBe(false);
  });
});

describe('noteClaimFailure / lastClaimDbFailureAt', () => {
  it('отказ из-за базы запоминается моментом тика, по имени аренды', () => {
    noteClaimFailure(
      'leaseA',
      new Error('P1017 Server has closed the connection'),
      new Date('2026-10-17T16:55:00Z'),
    );
    expect(lastClaimDbFailureAt('leaseA')).toBe(
      new Date('2026-10-17T16:55:00Z').getTime(),
    );
    expect(lastClaimDbFailureAt('leaseB')).toBeUndefined();
  });

  it('контроль: отказ другого рода не запоминается и не затирает прошлый', () => {
    noteClaimFailure(
      'leaseC',
      new Error("Can't reach database server"),
      new Date('2026-10-17T10:00:00Z'),
    );
    noteClaimFailure(
      'leaseC',
      new Error('relation "CronLease" does not exist'),
      new Date('2026-10-17T11:00:00Z'),
    );
    expect(lastClaimDbFailureAt('leaseC')).toBe(
      new Date('2026-10-17T10:00:00Z').getTime(),
    );
  });
});
