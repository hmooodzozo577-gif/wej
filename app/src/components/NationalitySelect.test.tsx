import { useReducer, type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { NationalitySelect } from './NationalitySelect';

function Providers({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'en' });
  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
}

describe('item #13 — optional nationality selection', () => {
  it('starts unset (skippable) and commits a real country when its exact name is typed', () => {
    render(<Providers><NationalitySelect /></Providers>);
    const input = screen.getByLabelText('Your nationality') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Japan' } });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('never shows a personalized-visa claim — only the shared privacy note', () => {
    render(<Providers><NationalitySelect /></Providers>);
    expect(screen.getByText(/Never inferred from your location/)).toBeInTheDocument();
  });
});
