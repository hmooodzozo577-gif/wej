import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DestinationCard } from './DestinationCard';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

describe('destination images on catalog cards', () => {
  it('renders a representative local image for every country card with a card-specific crop', () => {
    for (const destination of WORLD_CATALOG) {
      const { container, unmount } = render(
        <MemoryRouter>
          <DestinationCard dest={destination} lang="ar" t={I18N.ar} />
        </MemoryRouter>,
      );
      const image = container.querySelector<HTMLImageElement>('.destination-card-image');
      expect(image, destination.countryCode).not.toBeNull();
      expect(image!.getAttribute('src'), destination.countryCode).toBe(DESTINATION_VISUALS[destination.countryCode].imagePath);
      expect(image!.getAttribute('alt'), destination.countryCode).toBe(DESTINATION_VISUALS[destination.countryCode].altAr);
      expect(image!.style.objectFit, destination.countryCode).toBe('cover');
      expect(image!.style.objectPosition, destination.countryCode).toBe(DESTINATION_VISUALS[destination.countryCode].cardPosition);
      unmount();
    }
  });
});
