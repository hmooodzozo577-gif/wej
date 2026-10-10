// "قصة الاسم" — the copy of the footer's story-of-the-name dialog.
//
// The Arabic story is the approved text, word for word. The verse and its
// reference are quoted exactly and are never rewritten, translated or
// branded; the English story explains the name in its own words and shows
// the verse in its original Arabic, because the project has no sourced,
// authoritative English translation of the Quran to quote.
import type { Lang } from '../data/types';

/** Al-Qasas 28:22, as approved — quoted, never edited. */
export const NAME_STORY_VERSE = '﴿وَلَمّا تَوَجَّهَ تِلقاءَ مَديَنَ قالَ عَسى رَبّي أَن يَهدِيَني سَواءَ السَّبيلِ﴾';
/** Part of the quotation, so its Arabic-Indic digits stay as approved: the
 *  one deliberate exception to the app's Latin-digit rule (never pass it
 *  through toLatinDigits / deepLatinDigits). */
export const NAME_STORY_REFERENCE = '[القصص: ٢٢]';

export interface NameStoryStrings {
  /** The footer trigger. */
  open: string;
  title: string;
  close: string;
  intro: string;
  verseLead: string;
  /** Shown under the Arabic reference for readers who do not read Arabic. */
  referenceLocator?: string;
  meaning: string;
  /** Says plainly that the verse is not translated. */
  verseNote?: string;
  inspiration: string;
  tagline: string;
}

export const NAME_STORY_COPY = {
  ar: {
    open: 'قصة الاسم',
    title: 'تِلقاء — لكل وجهة حكاية',
    close: 'إغلاق',
    intro: 'لم يكن اختيار اسم تِلقاء مجرد اختيار لاسم مميز، بل كان اختيارًا لمعنى يحمل في طيّاته روح الرحلة والتوجّه والاكتشاف.',
    verseLead: 'قال الله تعالى:',
    meaning: 'تأتي كلمة «تِلقاء» في هذه الآية بمعنى نحو مدين أو باتجاهها، في مشهد يصوّر بداية رحلة نحو وجهة جديدة، مع الأمل في الوصول إلى الطريق الصحيح.',
    inspiration: 'ومن هذا المعنى استُلهم اسم تِلقاء؛ ليكون رفيقك في اكتشاف العالم، والتعرّف على وجهات جديدة، والعثور على المكان الذي يستحق أن يكون رحلتك القادمة.',
    tagline: 'تِلقاء — العالم في اتجاهك.',
  },
  en: {
    open: 'The story of the name',
    title: 'TILQAA — Every Destination Has a Story',
    close: 'Close',
    intro: 'TILQAA was not chosen simply as a distinctive name. It was chosen for a meaning that carries the spirit of the journey: heading somewhere new, and discovering it.',
    verseLead: 'The name is inspired by a word in this verse of the Quran:',
    referenceLocator: 'Al-Qasas 28:22',
    meaning: 'In this verse, the word tilqaa means toward Madyan, or in its direction — a scene that marks the start of a journey to a new destination, with the hope of finding the right way.',
    verseNote: 'The verse is quoted in its original Arabic.',
    inspiration: 'The name TILQAA was inspired by that meaning: to be your companion in discovering the world, getting to know new destinations and finding the place that deserves to be your next journey.',
    tagline: 'TILQAA — The World Within Your Reach.',
  },
} as const satisfies Record<Lang, NameStoryStrings>;
