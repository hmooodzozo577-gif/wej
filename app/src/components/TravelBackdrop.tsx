export function TravelBackdrop() {
  return (
    <svg
      className="global-travel-motif"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="global-travel-pattern" width="2100" height="1500" patternUnits="userSpaceOnUse">
          <path className="global-route-line" d="M-80 170 C140 30 300 305 520 130 S790 70 1010 230" />
          <path className="global-route-line global-route-line-secondary" d="M620 1310 C830 1110 1080 1450 1320 1200 S1760 1040 2180 1280" />
          <g className="global-plane" transform="translate(517 131) rotate(-18)">
            <path d="M19 0 6-4-2-17h-5l4 15-14-5-5 6 19 5-4 15h5L6 4Z" />
          </g>
          <g className="global-compass" transform="translate(1640 850)">
            <circle r="28" />
            <circle r="20" />
            <path d="M0-17 5 0 0 17-5 0Z" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#global-travel-pattern)" />
    </svg>
  );
}
