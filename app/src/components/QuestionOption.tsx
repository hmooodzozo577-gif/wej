// Ports the quiz answer-option markup/behavior from renderQuiz() in
// wejhaty.html (the `.q-option` button, role="radio"/aria-checked pattern).
import type { Lang } from '../data/types';
import type { QuestionOption as QuestionOptionData } from '../data/types';

export function QuestionOption({
  option,
  lang,
  selected,
  onSelect,
}: {
  option: QuestionOptionData;
  lang: Lang;
  selected: string | number | undefined;
  onSelect: (value: string | number) => void;
}) {
  const isSelected = selected === option.value;
  return (
    <button
      type="button"
      className={`q-option${isSelected ? ' selected' : ''}${option.desc ? ' has-desc' : ''}`}
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(option.value)}
    >
      <span className="radio" />
      <span className="opt-text">
        <span className="opt-label">{lang === 'ar' ? option.label.ar : option.label.en}</span>
        {option.desc ? (
          <span className="opt-desc">{lang === 'ar' ? option.desc.ar : option.desc.en}</span>
        ) : null}
      </span>
    </button>
  );
}
