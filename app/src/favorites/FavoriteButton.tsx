// v1.1 — save / unsave a destination. A toggle button: its name stays the
// same and aria-pressed carries the state; sighted users get a filled or
// outlined heart (a shape change, not colour alone) and every change is
// announced once through the shared live region.
import type { CatalogEntry, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { Icon } from '../components/Icon';
import { announce } from '../site/announce';
import { FAVORITES_COPY } from './copy';
import { useOptionalFavorites } from './context';

export function FavoriteButton({ destination, lang, variant = 'full' }: {
  destination: CatalogEntry;
  lang: Lang;
  variant?: 'full' | 'icon';
}) {
  const favorites = useOptionalFavorites();
  if (!favorites) return null;
  const copy = FAVORITES_COPY[lang];
  const name = nameOf(destination, lang);
  const saved = favorites.has(destination.id);
  const toggle = () => {
    favorites.toggle(destination.id);
    announce(saved ? copy.removed(name) : copy.added(name));
  };
  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`favorite-icon${saved ? ' is-saved' : ''}`}
        aria-pressed={saved}
        aria-label={copy.toggleFor(name)}
        title={copy.toggleFor(name)}
        onClick={toggle}
      >
        <Icon name={saved ? 'heartFilled' : 'heart'} size={18} />
      </button>
    );
  }
  return (
    <button type="button" className={`btn btn-ghost favorite-toggle${saved ? ' is-saved' : ''}`} aria-pressed={saved} onClick={toggle}>
      <Icon name={saved ? 'heartFilled' : 'heart'} size={18} /> {copy.toggle}
    </button>
  );
}
