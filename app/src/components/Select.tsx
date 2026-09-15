// Item #3 — a single reusable, Wejhaty-styled select shell. A bare native
// <select> gives no visible affordance that it's a dropdown at all (no
// chevron, no icon) — this wraps it with an optional leading icon and an
// always-visible chevron indicator, while keeping the real <select> element
// underneath untouched: full native keyboard support (arrow keys, type-to-
// select), the browser's own accessible name wiring, and RTL mirroring via
// plain CSS all keep working exactly as they did before.
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

export function Select({
  icon,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { icon?: ReactNode }) {
  return (
    <span className={`wj-select${icon ? ' wj-select-has-icon' : ''}${className ? ` ${className}` : ''}`}>
      {icon ? <span className="wj-select-icon" aria-hidden="true">{icon}</span> : null}
      <select {...props} className="wj-select-input">
        {children}
      </select>
      <Icon name="chevronDown" size={14} stroke={2.4} className="wj-select-chevron" />
    </span>
  );
}
