// The 8 purpose-specific question banks, ported verbatim from QUESTION_BANKS
// in wejhaty.html — same questions, weights, kinds, destKeys, and bilingual
// option text/wording. The shared option sets (BUDGET_OPTIONS, CLIMATE_OPTIONS,
// etc.) are inlined per-question here exactly as they resolve in the source
// JSON (their values are unchanged; only the "shared array reference" is not
// preserved, which has no user-facing effect).
import questionBanksJson from './generated/questionBanks.json';
import climateCompatJson from './generated/climateCompat.json';
import type { QuestionBanks, ClimateCompat } from './types';

export const QUESTION_BANKS: QuestionBanks = questionBanksJson as QuestionBanks;
export const CLIMATE_COMPAT: ClimateCompat = climateCompatJson as ClimateCompat;
