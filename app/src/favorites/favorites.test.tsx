import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { Favorites } from '../routes/Favorites';
import { FavoriteButton } from './FavoriteButton';
import { FavoritesProvider } from './FavoritesProvider';
import { useFavorites } from './context';
import { FAVORITES_STORAGE_KEY, cleanFavoriteIds, parseFavorites, serializeFavorites } from './store';
import type { StorageLike } from '../site/safeStorage';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const blockedStorage: StorageLike = {
  getItem: () => { throw new DOMException('insecure', 'SecurityError'); },
  setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
  removeItem: () => { throw new DOMException('insecure', 'SecurityError'); },
};

const japan = WORLD_CATALOG.find((entry) => entry.id === 'japan')!;

describe('favorites storage format', () => {
  it('stores only canonical ids under a versioned key', () => {
    expect(FAVORITES_STORAGE_KEY).toBe('wejhaty.favorites.v1');
    expect(JSON.parse(serializeFavorites(['japan', 'af']))).toEqual({ version: 1, ids: ['japan', 'af'] });
  });

  it('survives bad JSON, other shapes and unknown versions', () => {
    for (const raw of [null, '', '{not json', 'null', '"x"', '[1,2]', '{"version":2,"ids":["japan"]}', '{"version":1,"ids":"japan"}', '{"ids":["japan"]}']) {
      expect(parseFavorites(raw), String(raw)).toEqual([]);
    }
  });

  it('drops duplicates, unknown ids, deleted countries and Israel', () => {
    const raw = JSON.stringify({ version: 1, ids: ['japan', 'japan', 'atlantis', 'il', 'IL', 'israel', 42, null, 'af', { id: 'x' }] });
    expect(parseFavorites(raw)).toEqual(['japan', 'af']);
    expect(cleanFavoriteIds(['JAPAN', 'japan '])).toEqual([]);
  });

  it('never holds more than the catalog', () => {
    const everything = [...WORLD_CATALOG.map((entry) => entry.id), ...WORLD_CATALOG.map((entry) => entry.id)];
    expect(parseFavorites(serializeFavorites(everything))).toHaveLength(WORLD_CATALOG.length);
  });
});

function Probe() {
  const favorites = useFavorites();
  return <output data-testid="probe">{JSON.stringify({ ids: favorites.ids, persisted: favorites.persisted })}</output>;
}

const probe = () => JSON.parse(screen.getByTestId('probe').textContent!);

describe('FavoriteButton and FavoritesProvider', () => {
  it('saves and removes a destination, as a toggle with a stable name', () => {
    const storage = memoryStorage();
    render(<FavoritesProvider storage={storage}><FavoriteButton destination={japan} lang="en" /><Probe /></FavoritesProvider>);
    const button = screen.getByRole('button', { name: 'Favorite' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(storage.data[FAVORITES_STORAGE_KEY]!)).toEqual({ version: 1, ids: ['japan'] });
    fireEvent.click(button);
    expect(probe().ids).toEqual([]);
  });

  it('restores saved favorites after a reload', () => {
    const storage = memoryStorage({ [FAVORITES_STORAGE_KEY]: serializeFavorites(['japan', 'af']) });
    render(<FavoritesProvider storage={storage}><Probe /></FavoritesProvider>);
    expect(probe().ids).toEqual(['japan', 'af']);
  });

  it('keeps working for the page when storage is blocked or full', () => {
    render(<FavoritesProvider storage={blockedStorage}><FavoriteButton destination={japan} lang="ar" /><Probe /></FavoritesProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'المفضلة' }));
    expect(probe()).toEqual({ ids: ['japan'], persisted: false });
  });

  it('follows a change made in another tab', () => {
    render(<FavoritesProvider storage={memoryStorage()}><Probe /></FavoritesProvider>);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_STORAGE_KEY, newValue: serializeFavorites(['af']) }));
    });
    expect(probe().ids).toEqual(['af']);
  });

  it('renders nothing outside a provider instead of failing', () => {
    const { container } = render(<FavoriteButton destination={japan} lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels the compact card control with the destination name', () => {
    render(<FavoritesProvider storage={memoryStorage()}><FavoriteButton destination={japan} lang="en" variant="icon" /></FavoritesProvider>);
    expect(screen.getByRole('button', { name: 'Favorite: Japan' })).toHaveAttribute('aria-pressed', 'false');
  });
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderFavoritesPage(ids: string[]) {
  const storage = memoryStorage({ [FAVORITES_STORAGE_KEY]: serializeFavorites(ids) });
  return render(
    <AppStateProvider>
      <FavoritesProvider storage={storage}>
        <MemoryRouter initialEntries={['/favorites']}>
          <Routes>
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/compare" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </FavoritesProvider>
    </AppStateProvider>,
  );
}

describe('Favorites page', () => {
  it('shows a helpful empty state', () => {
    renderFavoritesPage([]);
    expect(screen.getByRole('heading', { level: 1, name: 'المفضلة' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'استكشف الوجهات' })).toHaveAttribute('href', '/explore');
  });

  it('lists saved destinations, removes one, and limits compare to three', () => {
    renderFavoritesPage(['japan', 'af', 'france', 'uk']);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'إزالة المملكة المتحدة من المفضلة' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    const compare = screen.getByRole('button', { name: /قارن المختار/ });
    expect(compare).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'اختر اليابان للمقارنة' }));
    expect(compare).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'اختر أفغانستان للمقارنة' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'اختر فرنسا للمقارنة' }));
    expect(compare).toBeEnabled();
    fireEvent.click(compare);
    expect(screen.getByTestId('location').textContent).toBe('/compare?ids=japan,af,france');
  });

  it('disables a fourth selection', () => {
    renderFavoritesPage(['japan', 'af', 'france', 'uk']);
    for (const name of ['اليابان', 'أفغانستان', 'فرنسا']) fireEvent.click(screen.getByRole('checkbox', { name: `اختر ${name} للمقارنة` }));
    expect(screen.getByRole('checkbox', { name: 'اختر المملكة المتحدة للمقارنة' })).toBeDisabled();
  });
});
