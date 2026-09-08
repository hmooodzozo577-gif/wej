// Ports the .btn/.btn-primary/.btn-gold/.btn-ghost/.btn-sm classes from
// wejhaty.html's CSS into a small reusable component. Purely a class-name
// helper — no new visual behavior.
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'gold' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

export function Button({ variant = 'primary', small, className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, small ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
