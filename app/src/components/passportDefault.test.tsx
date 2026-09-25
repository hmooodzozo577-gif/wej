import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { useAppState } from '../state/hooks';
import { PassportSelect } from './PassportSelect';
import { usePassportDefault } from './usePassportDefault';

const RIYADH = { lat: 24.7136, lng: 46.6753 };
const MID_ATLANTIC = { lat: 0, lng: -30 };

function Harness() {
  const { state, dispatch } = useAppState();
  const passportDefault = usePassportDefault(state);
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'LOCATION_GRANTED', coords: RIYADH })}>riyadh</button>
      <button type="button" onClick={() => dispatch({ type: 'LOCATION_GRANTED', coords: MID_ATLANTIC })}>ocean</button>
      <button type="button" onClick={() => dispatch({ type: 'LOCATION_GRANTED', coords: { lat: 25.2048, lng: 55.2708 } })}>dubai</button>
      <PassportSelect defaultCode={passportDefault} />
      <output data-testid="state">{JSON.stringify({ passport: state.passportCode, chosen: state.passportChosen, fallback: passportDefault })}</output>
    </>
  );
}

const snapshot = () => JSON.parse(screen.getByTestId('state').textContent!);
const combobox = () => screen.getByRole('combobox', { name: /جواز سفر|passport/i });

function renderHarness() {
  return render(<AppStateProvider><Harness /></AppStateProvider>);
}

describe('passport default from the current location', () => {
  it('shows the current country as a plain initial selection, without writing it anywhere', async () => {
    const storageBefore = { local: { ...localStorage }, session: { ...sessionStorage } };
    renderHarness();
    expect(combobox()).not.toHaveTextContent('السعودية');
    act(() => fireEvent.click(screen.getByText('riyadh')));
    await waitFor(() => expect(combobox()).toHaveTextContent('السعودية'));
    // Displayed only: the session passport is still unset and unchosen.
    expect(snapshot()).toEqual({ passport: null, chosen: false, fallback: 'SA' });
    // No wording about location or inferred nationality anywhere near it.
    expect(document.body.textContent).not.toMatch(/موقعك|based on your location|suggest|نعتقد|we think/i);
    // Nothing persisted.
    expect({ local: { ...localStorage }, session: { ...sessionStorage } }).toEqual(storageBefore);
  });

  it('never uses an approximate (nearest-centroid) country', async () => {
    renderHarness();
    act(() => fireEvent.click(screen.getByText('ocean')));
    // Give the async resolver time to finish, then confirm nothing appeared.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(snapshot().fallback).toBeNull();
  });

  it('never overwrites a manual choice, even when the location changes afterwards', async () => {
    renderHarness();
    act(() => fireEvent.click(screen.getByText('riyadh')));
    await waitFor(() => expect(snapshot().fallback).toBe('SA'));
    fireEvent.click(combobox());
    fireEvent.change(screen.getByPlaceholderText('ابحث عن دولة…'), { target: { value: 'مصر' } });
    fireEvent.click(screen.getByRole('option', { name: /مصر/ }));
    expect(snapshot()).toEqual({ passport: 'EG', chosen: true, fallback: null });
    act(() => fireEvent.click(screen.getByText('dubai')));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(snapshot()).toEqual({ passport: 'EG', chosen: true, fallback: null });
    expect(combobox()).toHaveTextContent('مصر');
  });

  it('treats clearing the field as a choice: the default does not come back', async () => {
    renderHarness();
    act(() => fireEvent.click(screen.getByText('riyadh')));
    await waitFor(() => expect(combobox()).toHaveTextContent('السعودية'));
    fireEvent.click(screen.getByRole('button', { name: /مسح|Clear/ }));
    expect(snapshot()).toEqual({ passport: null, chosen: true, fallback: null });
    expect(combobox()).not.toHaveTextContent('السعودية');
  });

  it('does nothing without a granted location', () => {
    renderHarness();
    expect(snapshot()).toEqual({ passport: null, chosen: false, fallback: null });
  });
});
