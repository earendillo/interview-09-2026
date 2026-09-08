import type { Ref } from 'react';
import styles from './button.module.scss';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  /** `primary` is the accent button; `secondary` is the quieter outline one. */
  variant?: 'primary' | 'secondary';
  /** Optional hook for tests, forwarded as `data-testid`. */
  testId?: string;
  /**
   * React 19: `ref` is an ordinary prop for function components, so no
   * `forwardRef` wrapper is needed to let a caller focus this button.
   */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  label,
  onClick,
  variant = 'primary',
  testId,
  ref,
}: ButtonProps) {
  const className =
    variant === 'secondary'
      ? `${styles.button} ${styles.secondary}`
      : styles.button;

  return (
    <button
      type="button"
      ref={ref}
      className={className}
      data-testid={testId}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
