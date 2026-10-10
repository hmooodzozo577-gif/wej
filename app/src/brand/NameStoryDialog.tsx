// "قصة الاسم" — a quiet footer button that opens the story of the name.
// Same modal conventions as FeedbackDialog: a labelled dialog with
// aria-modal, a backdrop that blocks the page, Escape and the backdrop
// close it, Tab stays inside, the page does not scroll behind it and focus
// returns to the trigger.
import { useEffect, useId, useRef, useState } from 'react';
import type { Lang } from '../data/types';
import { Icon } from '../components/Icon';
import { NAME_STORY_COPY, NAME_STORY_REFERENCE, NAME_STORY_VERSE } from './nameStoryCopy';

const FOCUSABLE = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

export function NameStoryDialog({ lang }: { lang: Lang }) {
  const copy: (typeof NAME_STORY_COPY)[Lang] = NAME_STORY_COPY[lang];
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const openerElement = opener.current;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', keepFocusInDialog);
      openerElement?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={opener} type="button" className="name-story-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {copy.open}
      </button>
      {open ? (
        <div
          className="feedback-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            // Cancel the browser's own mousedown focus step, which would
            // otherwise move focus to <body> after it was handed back.
            event.preventDefault();
            setOpen(false);
          }}
        >
          <section ref={dialog} className="feedback-dialog name-story-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
            <div className="feedback-dialog-head">
              <h2 id={titleId}>{copy.title}</h2>
              <button type="button" className="feedback-close name-story-close" aria-label={copy.close} onClick={() => setOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="name-story-body">
              <p>{copy.intro}</p>
              <p>{copy.verseLead}</p>
              <figure className="name-story-verse">
                <blockquote lang="ar" dir="rtl">{NAME_STORY_VERSE}</blockquote>
                <figcaption>
                  <cite lang="ar" dir="rtl">{NAME_STORY_REFERENCE}</cite>
                  {'referenceLocator' in copy ? <span className="name-story-locator">{copy.referenceLocator}</span> : null}
                </figcaption>
              </figure>
              <p>{copy.meaning}</p>
              {'verseNote' in copy ? <p className="name-story-note">{copy.verseNote}</p> : null}
              <p>{copy.inspiration}</p>
              <p className="name-story-tagline">{copy.tagline}</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
