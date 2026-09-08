import type { I18nDict, Lang } from '../types';
import { AR } from './ar';
import { EN } from './en';

export const I18N: Record<Lang, I18nDict> = { ar: AR, en: EN };

export function t(lang: Lang): I18nDict {
  return I18N[lang];
}
