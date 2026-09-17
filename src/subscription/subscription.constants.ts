// Subscription charges live in their own InvId range so the shared Robokassa
// Result webhook can route by range. Below int32 max (2_147_483_647).
export const SUBSCRIPTION_INVID_BASE = 2_000_000_000;
