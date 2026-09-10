// Phase 16 — AI API Integration, Capability A (natural preference
// interpretation). Optional free-text box mounted on the Quiz page: the
// questionnaire works perfectly without ever touching this component.
// AI never mutates state.answers directly — every interpreted value is
// shown to the user as a checked-by-default PROPOSAL they must apply
// (or dismiss) themselves; only "Apply selected" ever dispatches
// SET_ANSWER. Calls interpretPreferences() only on explicit submit
// (never on every keystroke/render), and only once per submit (the
// button disables itself while a request is in flight).
import { useState, type FormEvent } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { interpretPreferences } from '../ai/aiService';
import type { InterpretedPreference } from '../ai/types';
import type { Question } from '../data/types';
import { Icon } from './Icon';

type Status = 'idle' | 'loading' | 'proposed' | 'none' | 'unavailable' | 'error';

export function NaturalPreferenceInput({ questions }: { questions: Question[] }) {
  const { lang, t } = useI18n();
  const { dispatch } = useAppState();
  const ai = t.ai.interpret;

  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [proposals, setProposals] = useState<InterpretedPreference[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const questionById = new Map(questions.map((q) => [q.id, q]));

  function labelFor(p: InterpretedPreference): string {
    const q = questionById.get(p.questionId);
    if (!q) return String(p.value);
    const opt = q.options.find((o) => o.value === p.value);
    const qText = lang === 'ar' ? q.text.ar : q.text.en;
    const optText = opt ? (lang === 'ar' ? opt.label.ar : opt.label.en) : String(p.value);
    return `${qText}: ${optText}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading' || text.trim().length === 0) return;
    setStatus('loading');
    const result = await interpretPreferences(
      lang,
      text,
      questions.map((q) => ({ id: q.id, kind: q.kind, options: q.options.map((o) => o.value) })),
    );
    if (result.status === 'ok') {
      setUnmapped(result.unmapped);
      if (result.interpreted.length === 0) {
        setStatus('none');
        return;
      }
      setProposals(result.interpreted);
      setSelected(new Set(result.interpreted.map((p) => p.questionId)));
      setStatus('proposed');
    } else if (result.status === 'unavailable') {
      setStatus('unavailable');
    } else {
      setStatus('error');
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onApply() {
    for (const p of proposals) {
      if (selected.has(p.questionId)) {
        dispatch({ type: 'SET_ANSWER', questionId: p.questionId, value: p.value });
      }
    }
    reset();
  }

  function reset() {
    setStatus('idle');
    setProposals([]);
    setUnmapped([]);
    setSelected(new Set());
    setText('');
  }

  return (
    <div className="detail-card ai-interpret-card">
      <h3>
        <Icon name="sparkle" size={16} /> {ai.title}
      </h3>
      <form onSubmit={onSubmit}>
        <textarea
          className="ai-interpret-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ai.placeholder}
          rows={2}
          maxLength={500}
          aria-label={ai.title}
        />
        <div className="ai-interpret-actions">
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={status === 'loading' || text.trim().length === 0}
          >
            {status === 'loading' ? ai.loading : ai.cta}
          </button>
        </div>
      </form>

      {status === 'unavailable' && <p className="ai-interpret-note">{ai.unavailable}</p>}
      {status === 'error' && <p className="ai-interpret-note">{ai.error}</p>}
      {status === 'none' && <p className="ai-interpret-note">{ai.noneFound}</p>}

      {status === 'proposed' && (
        <div className="ai-interpret-proposals">
          <div className="ai-interpret-proposed-title">{ai.proposedTitle}</div>
          {proposals.map((p) => (
            <label key={p.questionId} className="ai-interpret-proposal">
              <input type="checkbox" checked={selected.has(p.questionId)} onChange={() => toggle(p.questionId)} />
              <span>{labelFor(p)}</span>
            </label>
          ))}
          {unmapped.length > 0 && <p className="ai-interpret-note">{ai.unmappedNote}</p>}
          <div className="ai-interpret-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onApply} disabled={selected.size === 0}>
              {ai.apply}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              {ai.dismiss}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
