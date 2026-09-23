// Item #1 — the custom listbox. These tests exist because the thing being
// replaced (a native <select>) had all of this behavior for free: losing any
// of it would be a regression the browser used to prevent. Every assertion
// below is something a native select did and this component must keep doing.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select, type SelectOption } from './Select';

const OPTIONS: SelectOption[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'bravo', label: 'Bravo' },
  { value: 'charlie', label: 'Charlie' },
  { value: 'delta', label: 'Delta', disabled: true },
  { value: 'echo', label: 'Echo' },
];

function setup(overrides: Partial<React.ComponentProps<typeof Select>> = {}) {
  const onChange = vi.fn();
  render(
    <Select aria-label="Test select" value="alpha" options={OPTIONS} onChange={onChange} {...overrides} />,
  );
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Test select' }) };
}

describe('Select — closed state', () => {
  it('shows the selected option label and no listbox', () => {
    const { trigger } = setup();
    expect(trigger).toHaveTextContent('Alpha');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('falls back to the placeholder when the value matches no option', () => {
    setup({ value: '', placeholder: 'Choose one' });
    expect(screen.getByRole('combobox', { name: 'Test select' })).toHaveTextContent('Choose one');
  });
});

describe('Select — mouse', () => {
  it('opens on click, commits on option click, and closes', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Charlie' }));
    expect(onChange).toHaveBeenCalledWith('charlie');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('never commits a disabled option', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Delta' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on an outside pointer press without committing', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Select — keyboard', () => {
  it('opens with ArrowDown, Enter and Space', () => {
    const { trigger } = setup();
    for (const key of ['ArrowDown', 'Enter', ' ']) {
      fireEvent.keyDown(trigger, { key });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: 'Escape' });
    }
  });

  it('moves the active option with the arrow keys and commits with Enter', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('bravo');
  });

  it('opens with the CURRENT value active, then skips a disabled option while navigating', () => {
    const { onChange, trigger } = setup({ value: 'charlie' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // opens, active = charlie (the current value)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // charlie -> delta (disabled) -> echo
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('echo');
  });

  it('commits with Space in the non-searchable listbox', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith('bravo');
  });

  it('Home and End jump to the first and last enabled options', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('echo');
  });

  it('Escape closes without committing and returns focus to the trigger', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab closes the list and lets focus move on', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('type-ahead jumps to a matching option, as a native select did', () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'c' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('charlie');
  });
});

describe('Select — ARIA wiring', () => {
  it('marks only the current value as selected', () => {
    const { trigger } = setup({ value: 'bravo' });
    fireEvent.click(trigger);
    const selected = screen.getAllByRole('option').filter((node) => node.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Bravo');
  });

  it('points aria-activedescendant at the active option, which starts on the current value', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const onOpen = trigger.getAttribute('aria-activedescendant');
    expect(onOpen).toBeTruthy();
    expect(document.getElementById(onOpen!)).toHaveTextContent('Alpha');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const moved = trigger.getAttribute('aria-activedescendant');
    expect(document.getElementById(moved!)).toHaveTextContent('Bravo');
  });

  it('is operable by an accessible name from a visible label element', () => {
    render(
      <>
        <span id="external-label">Region</span>
        <Select labelledBy="external-label" value="alpha" options={OPTIONS} onChange={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeInTheDocument();
  });
});

describe('Select — searchable variant', () => {
  it('filters options by the typed query and commits the match', () => {
    const { onChange, trigger } = setup({ searchable: true, searchPlaceholder: 'Search' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'ech' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith('echo');
  });

  it('shows the empty message when nothing matches, and commits nothing', () => {
    const { onChange, trigger } = setup({ searchable: true, searchPlaceholder: 'Search', emptyText: 'No matches' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(screen.getByPlaceholderText('Search'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats Space as a search character, not as "select"', () => {
    const { onChange, trigger } = setup({ searchable: true, searchPlaceholder: 'Search' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByPlaceholderText('Search'), { key: ' ' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Select — viewport collision (Phase 19, 19.3A)', () => {
  function rect(left: number, width: number): DOMRect {
    return { left, right: left + width, width, top: 0, bottom: 40, height: 40, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
  }

  it('shifts an open list that would cross a screen edge back inside it', () => {
    const clientWidth = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(360);
    const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      // The list would open from x=300 and be 170px wide: 110px past a 360px screen.
      if (this.classList.contains('wj-select-popover')) return this.style.left ? rect(8 + 300 - 290, 170) : rect(300, 170);
      if (this.classList.contains('wj-select')) return rect(290, 52);
      return rect(0, 0);
    });
    render(<Select aria-label="Theme" value="auto" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    const popover = document.querySelector<HTMLElement>('.wj-select-popover')!;
    // Right edge clamped to 360 - 8: left = 352 - 170 = 182, relative to the control at 290.
    expect(popover.style.left).toBe('-108px');
    expect(popover.style.right).toBe('auto');
    expect(popover.style.width).toBe('170px');
    clientWidth.mockRestore();
    boxes.mockRestore();
  });

  it('leaves a list that already fits exactly where the stylesheet put it', () => {
    const clientWidth = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
    const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(400, 200));
    render(<Select aria-label="Theme" value="auto" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    const popover = document.querySelector<HTMLElement>('.wj-select-popover')!;
    expect(popover.style.left).toBe('');
    expect(popover.style.width).toBe('');
    clientWidth.mockRestore();
    boxes.mockRestore();
  });
});
