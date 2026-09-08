import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from 'react';
import styles from './remote-slot.module.scss';

interface RemoteErrorBoundaryProps {
  label: string;
  children: ReactNode;
}

/**
 * A remote that fails to load must not take the rest of the shell down, so each
 * one is wrapped in its own boundary. React.lazy surfaces a rejected import as
 * a render error, which is what this catches.
 */
class RemoteErrorBoundary extends Component<
  RemoteErrorBoundaryProps,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <p role="status" className={`${styles.message} ${styles.failed}`}>
          Unable to load {this.props.label}
        </p>
      );
    }
    return this.props.children;
  }
}

interface RemoteSlotProps {
  /** Human-readable remote name, used in the loading and error messages. */
  label: string;
  /** Dynamic import of the federated module. */
  loader: () => Promise<{ default: ComponentType }>;
}

/** Renders one federated component with its own loading and error fallback. */
export function RemoteSlot({ label, loader }: RemoteSlotProps) {
  const Remote = lazy(loader);

  return (
    <RemoteErrorBoundary label={label}>
      <Suspense
        fallback={
          <p role="status" className={styles.message}>
            Loading {label}...
          </p>
        }
      >
        <Remote />
      </Suspense>
    </RemoteErrorBoundary>
  );
}
