// Item #13 — the shared 1-5 star control.
//
// Both rating forms (a whole recommendation set, and one destination page)
// use exactly this control, so the interaction, the keyboard behaviour and
// the accessible naming cannot drift apart between them.
//
// It is a radio group, not five buttons: a rating is one choice out of five,
// arrow keys move between them, and a screen reader announces "3 of 5"
// rather than five unrelated "star" buttons.
import type { Lang } from '../data/types';
import { formatNumber } from '../data/format';

const VALUES = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
  label,
  lang,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  lang: Lang;
  disabled?: boolean;
}) {
  const optionLabel = (star: number) =>
    lang === 'ar' ? `${formatNumber(star)} من ${formatNumber(5)}` : `${formatNumber(star)} of ${formatNumber(5)}`;

  return (
    <div className="rating-stars" role="radiogroup" aria-label={label}>
      {VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={optionLabel(star)}
          className={star <= value ? 'selected' : ''}
          disabled={disabled}
          // Arrow keys move the selection, as a radio group must.
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault();
              onChange(Math.min(5, (value || star) + 1));
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault();
              onChange(Math.max(1, (value || star) - 1));
            }
          }}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
