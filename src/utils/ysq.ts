/**
 * Minimal YSQ-R scoring: mirrors YSQTestSheet.tsx logic.
 * Returns schema IDs with pct5plus > 50% (same threshold as frontend).
 */

const YSQ_SCHEMAS: { id: string; questions: number[] }[] = [
  { id: 'emotional_deprivation',  questions: [1,2,3,4,5] },
  { id: 'abandonment',            questions: [6,7,8,9,10,11,12,13] },
  { id: 'mistrust',               questions: [14,15,16,17,18] },
  { id: 'social_isolation',       questions: [19,20,21,22,23] },
  { id: 'defectiveness',          questions: [24,25,26,27,28,29] },
  { id: 'failure',                questions: [30,31,32,33,34,35] },
  { id: 'dependence',             questions: [36,37,38,39,40,41,42,43] },
  { id: 'vulnerability',          questions: [44,45,46,47,48,49] },
  { id: 'enmeshment',             questions: [50,51,52,53,54,55,56] },
  { id: 'subjugation',            questions: [57,58,59,60,61] },
  { id: 'self_sacrifice',         questions: [62,63,64,65,66,67] },
  { id: 'emotion_inhibition_fear',questions: [68,69,70,71] },
  { id: 'emotional_inhibition',   questions: [72,73,74,75,76] },
  { id: 'unrelenting_standards',  questions: [77,78,79,80,81,82,83] },
  { id: 'entitlement',            questions: [84,85,86,87,88,89] },
  { id: 'insufficient_self_control', questions: [90,91,92,93,94,95,96] },
  { id: 'approval_seeking',       questions: [97,98,99,100,101] },
  { id: 'negativity',             questions: [102,103,104,105,106,107] },
  { id: 'punitiveness_self',      questions: [108,109,110,111,112] },
  { id: 'punitiveness_others',    questions: [113,114,115,116] },
];

export interface YsqSchemaScore {
  id: string;
  pct5plus: number; // % of questions rated ≥5
}

export function computeYsqScores(answers: number[]): YsqSchemaScore[] {
  return YSQ_SCHEMAS.map(schema => {
    const vals = schema.questions.map(q => answers[q - 1] ?? 0);
    const pct5plus = vals.length > 0
      ? Math.round((vals.filter(v => v >= 5).length / schema.questions.length) * 100)
      : 0;
    return { id: schema.id, pct5plus };
  });
}

export function computeActiveSchemas(answers: number[]): string[] {
  return computeYsqScores(answers)
    .filter(s => s.pct5plus > 50)
    .map(s => s.id);
}
