// Arabic strings, ported verbatim from I18N.ar in wejhaty.html. Arabic
// remains the default language.
//
// Phase 10: the original never needed continent labels beyond the 5 the 30
// destinations use, so `regionLabels.Africa`/`SouthAmerica` don't exist in
// the extracted JSON. Added here at the wrapper layer (not by hand-editing
// the generated file) — standard geographic terminology, not invented data.
import arJson from '../generated/i18n.ar.json';
import type { I18nDict } from '../types';

const base = arJson as I18nDict;

export const AR: I18nDict = {
  ...base,
  regionLabels: {
    ...base.regionLabels,
    Africa: 'أفريقيا',
    SouthAmerica: 'أمريكا الجنوبية',
  },
  detail: {
    ...base.detail,
    capital: 'العاصمة',
    notRecommendationReady:
      'لا تتوفر بعد بيانات كافية لتضمين هذه الوجهة في محرك التوصيات — ستُضاف في مرحلة قادمة.',
  },
};
