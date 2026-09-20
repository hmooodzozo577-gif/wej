export function CompassMark({ className = '', size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      className={`compass-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="compass-ring-outer" cx="60" cy="60" r="54" />
      <circle className="compass-ring-inner" cx="60" cy="60" r="42" />
      <g className="compass-ticks">
        {Array.from({ length: 24 }, (_, index) => (
          <line key={index} x1="60" y1={index % 3 === 0 ? 9 : 12} x2="60" y2={index % 3 === 0 ? 16 : 15} transform={`rotate(${index * 15} 60 60)`} />
        ))}
      </g>
      <text x="60" y="23" textAnchor="middle">N</text>
      <text x="60" y="103" textAnchor="middle">S</text>
      <text x="99" y="64" textAnchor="middle">E</text>
      <text x="21" y="64" textAnchor="middle">W</text>
      <g className="compass-needle">
        <path className="compass-needle-north" d="M60 22 69 60 60 55 51 60Z" />
        <path className="compass-needle-south" d="M60 98 51 60 60 65 69 60Z" />
        <circle cx="60" cy="60" r="5" />
        <circle cx="60" cy="60" r="2" />
      </g>
    </svg>
  );
}
