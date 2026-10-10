// The brand mark shown beside the name in the header and the footer: the
// existing compass glyph inside the .brand-mark disc. One component, so the
// separately designed TILQAA logo replaces it in one place.
export function BrandMark({ size }: { size: number }) {
  return (
    <span className="brand-mark">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9.5" stroke="#EBE7DC" strokeWidth="1.4" />
        <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" fill="#D9A85C" />
      </svg>
    </span>
  );
}
