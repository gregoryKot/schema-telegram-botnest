-- Cleanup orphaned virtual-client conceptualizations.
-- Virtual clients use negative clientId = -TherapyRelation.id.
-- A merge bug (IS DISTINCT FROM missing) caused their relations to be deleted
-- while leaving the conceptualization rows alive. Those "ghost" rows pollute
-- newly created virtual clients that happen to get the same relation id.
DELETE FROM "ClientConceptualization" cc
WHERE cc."clientId" < 0
  AND NOT EXISTS (
    SELECT 1 FROM "TherapyRelation" tr
    WHERE tr.id = -cc."clientId"
      AND tr."therapistId" = cc."therapistId"
      AND tr.status = 'active'
  );

-- Same cleanup for TherapistNote (virtual-client notes with no active relation).
DELETE FROM "TherapistNote" tn
WHERE tn."clientId" < 0
  AND NOT EXISTS (
    SELECT 1 FROM "TherapyRelation" tr
    WHERE tr.id = -tn."clientId"
      AND tr."therapistId" = tn."therapistId"
      AND tr.status = 'active'
  );
