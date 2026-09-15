// Item #1 — a real Wejhaty dropdown.
//
// The previous version wrapped a NATIVE <select> with a chevron and a
// leading icon. That fixed the CLOSED control only: clicking it still handed
// rendering to the browser/OS, which draws its own menu — system font,
// system colors, no Wejhaty identity, no dark-theme awareness, and on mobile
// a full-screen OS picker. The user's acceptance note is precise about this:
// "the closed control improved, but the OPEN dropdown still looks old".
//
// This is a listbox built from scratch instead. No dependency was added: the
// entire interaction is ~200 lines of state plus the WAI-ARIA listbox
// keyboard contract, which is far less code than any combobox library would
// have pulled in.
//
// Accessibility contract implemented here (matching the APG listbox pattern):
//   - trigger is role="combobox" with aria-expanded / aria-controls, and
//     aria-activedescendant pointing at the visually-active option
//   - ArrowDown/ArrowUp move the active option (and OPEN the list when
//     closed); Home/End jump to the ends; PageUp/PageDown move by 5
//   - Enter or Space commits the active option; Escape closes and returns
//     focus to the trigger without committing; Tab closes and lets focus
//     move on naturally
//   - type-ahead: typing letters jumps to the next option starting with
//     them, the one genuinely useful behavior a native <select> gave for
//     free, reimplemented rather than lost
//   - `searchable` swaps type-ahead for a real filter input (used by the
//     passport selector, which has ~194 options)
//   - the open list is a labelled listbox; each row is an option with
//     aria-selected, so a screen reader announces position and selection
//
// RTL/LTR is handled entirely with CSS logical properties (see wejhaty.css)
// — there is no `dir`-dependent JS here, and arrow keys are semantic
// (down = next option) in both directions, which is what the APG specifies.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional second line, e.g. a short qualifier under the label. */
  hint?: string;
  /** Optional leading visual for the row (a flag chip, an icon). */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name. Pair with `labelledBy` when a visible <label> exists. */
  'aria-label'?: string;
  labelledBy?: string;
  /** Leading icon for the closed control. */
  icon?: ReactNode;
  /** Shown when `value` matches no option (e.g. an optional, unset field). */
  placeholder?: string;
  /** Renders a filter input inside the open list. For long option sets. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

const TYPEAHEAD_RESET_MS = 700;
const PAGE_STEP = 5;

function nextEnabledIndex(options: SelectOption[], from: number, step: number): number {
  if (!options.length) return -1;
  let index = from;
  for (let i = 0; i < options.length; i += 1) {
    index += step;
    if (index < 0) index = 0;
    if (index > options.length - 1) index = options.length - 1;
    if (!options[index]?.disabled) return index;
    // Walked into the end of the list with only disabled options left.
    if (index === 0 || index === options.length - 1) break;
  }
  return options.findIndex((option) => !option.disabled);
}

export function Select({
  id,
  value,
  options,
  onChange,
  labelledBy,
  icon,
  placeholder,
  searchable = false,
  searchPlaceholder,
  emptyText,
  disabled = false,
  className,
  ...rest
}: SelectProps) {
  const reactId = useId();
  const listId = `${id ?? reactId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndexState, setActiveIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ buffer: '', at: 0 });

  const visible = useMemo(() => {
    if (!searchable) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  // Derived during render rather than corrected in an effect: a filter that
  // narrows the list must never leave the active index pointing past the end
  // of it, and fixing that with setState-in-effect would cost an extra render.
  const activeIndex = activeIndexState > visible.length - 1 ? (visible.length ? 0 : -1) : activeIndexState;

  const selected = options.find((option) => option.value === value);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (option: SelectOption | undefined) => {
      if (!option || option.disabled) return;
      if (option.value !== value) onChange(option.value);
      close(true);
    },
    [close, onChange, value],
  );

  const openList = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : options.findIndex((option) => !option.disabled));
  }, [disabled, options, value]);

  // Close on an outside pointer press or a scroll of an ancestor — the two
  // ways an anchored popover stops being anchored to anything meaningful.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onWindowBlur = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [close, open]);

  // Flip the list above the control when there isn't room below it — a
  // dropdown that opens off the bottom of a phone screen is unusable.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const room = window.innerHeight - rect.bottom;
    setDropUp(room < 240 && rect.top > room);
  }, [open, visible.length]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    // Guarded: scrollIntoView is absent in jsdom and in some older WebViews,
    // and keeping the active option visible is an enhancement, not a
    // requirement for the listbox to work.
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    const key = event.key;

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (key) {
      case 'Escape':
        event.preventDefault();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => nextEnabledIndex(visible, current, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => nextEnabledIndex(visible, current <= 0 ? visible.length : current, -1));
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(nextEnabledIndex(visible, -1, 1));
        return;
      case 'End':
        event.preventDefault();
        setActiveIndex(nextEnabledIndex(visible, visible.length, -1));
        return;
      case 'PageDown':
        event.preventDefault();
        setActiveIndex((current) => nextEnabledIndex(visible, current + PAGE_STEP - 1, 1));
        return;
      case 'PageUp':
        event.preventDefault();
        setActiveIndex((current) => nextEnabledIndex(visible, current - PAGE_STEP + 1, -1));
        return;
      case 'Enter':
        event.preventDefault();
        commit(visible[activeIndex]);
        return;
      case ' ':
      case 'Spacebar':
        // In the searchable variant a space is a legitimate search
        // character, so only the plain listbox treats it as "select".
        if (searchable) return;
        event.preventDefault();
        commit(visible[activeIndex]);
        return;
      default:
        break;
    }

    if (!searchable && key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      typeahead.current.buffer = now - typeahead.current.at > TYPEAHEAD_RESET_MS ? key : typeahead.current.buffer + key;
      typeahead.current.at = now;
      const needle = typeahead.current.buffer.toLowerCase();
      const match = visible.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(needle));
      if (match >= 0) setActiveIndex(match);
    }
  };

  const triggerLabel = selected?.label ?? placeholder ?? '';

  return (
    <div
      ref={rootRef}
      className={`wj-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
        aria-label={rest['aria-label']}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        className={`wj-select-trigger${icon ? ' has-icon' : ''}${selected ? '' : ' is-placeholder'}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {icon ? <span className="wj-select-icon" aria-hidden="true">{icon}</span> : null}
        <span className="wj-select-value">{triggerLabel}</span>
        <Icon name="chevronDown" size={14} stroke={2.4} className="wj-select-chevron" />
      </button>

      {open ? (
        <div className={`wj-select-popover${dropUp ? ' drop-up' : ''}`}>
          {searchable ? (
            <div className="wj-select-search">
              <Icon name="search" size={14} stroke={2.2} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                autoComplete="off"
                aria-controls={listId}
                aria-autocomplete="list"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>
          ) : null}
          <div ref={listRef} id={listId} role="listbox" aria-label={rest['aria-label']} className="wj-select-list" tabIndex={-1}>
            {visible.length ? (
              visible.map((option, index) => (
                <div
                  key={option.value}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={`wj-select-option${index === activeIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                >
                  {option.icon ? <span className="wj-select-option-icon">{option.icon}</span> : null}
                  <span className="wj-select-option-text">
                    <span className="wj-select-option-label">{option.label}</span>
                    {option.hint ? <span className="wj-select-option-hint">{option.hint}</span> : null}
                  </span>
                  <Icon name="check" size={15} stroke={2.6} className="wj-select-check" />
                </div>
              ))
            ) : (
              <p className="wj-select-empty">{emptyText}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
