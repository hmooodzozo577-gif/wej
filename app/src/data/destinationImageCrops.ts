/** Crop focal points from the 194-country card + hero contact-sheet review.
 * Unlisted images passed with a centered crop on both surfaces. */
export const DESTINATION_IMAGE_CROPS: Record<string, { card?: string; hero?: string }> = {
  BF: { hero: '50% 58%' },
  NG: { card: '50% 68%', hero: '50% 68%' },
  PT: { hero: '50% 40%' },
  TD: { hero: '50% 58%' },
  TO: { hero: '50% 60%' },
  ZM: { card: '50% 68%', hero: '50% 72%' },
};
