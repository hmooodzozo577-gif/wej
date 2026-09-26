// v1.1 — the one multi-select question in the questionnaire: "which
// languages can you use while travelling?". Same option look as the
// single-choice questions (QuestionOption), as checkboxes, plus an explicit
// Continue once at least one language is chosen. The answer is the
// canonical "ar,en" form (travelNeeds.languageAnswer).
import { useState } from 'react';
import type { Lang, Question } from '../data/types';
import { TRAVEL_NEED_COPY, languageAnswer, parseLanguageAnswer } from '../personalization/travelNeeds';
import { Icon } from './Icon';

export function LanguageChoice({
  question,
  lang,
  value,
  disabled,
  onSubmit,
}: {
  question: Question;
  lang: Lang;
  value: string | number | undefined;
  disabled: boolean;
  onSubmit: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => parseLanguageAnswer(value) ?? []);
  const copy = TRAVEL_NEED_COPY[lang];
  const toggle = (code: string) =>
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));

  return (
    <>
      <p className="q-hint">{copy.chooseLanguages}</p>
      <div className="q-options lang-options">
        {question.options.map((option) => {
          const code = String(option.value);
          const checked = selected.includes(code);
          return (
            <button
              key={code}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className={`q-option q-check${checked ? ' selected' : ''}`}
              onClick={() => toggle(code)}
            >
              <span className="check" aria-hidden="true" />
              <span className="opt-text">
                <span className="opt-label">{lang === 'ar' ? option.label.ar : option.label.en}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="q-multi-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || !selected.length}
          onClick={() => onSubmit(languageAnswer(selected))}
        >
          {copy.continue} <Icon name="arrowEnd" size={16} />
        </button>
      </div>
    </>
  );
}
