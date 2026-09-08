import { useEffect, useRef, useState } from 'react';
import { SUPPORTED_CONTRACT } from '../federation/manifest';
import styles from './remote-slot.module.scss';

export type Unmount = () => void;

export interface ForeignRemoteModule {
  contract: number;
  mount: (container: Element, props?: Record<string, unknown>) => Unmount;
}

export interface ForeignRemoteProps {
  label: string;
  loader: () => Promise<ForeignRemoteModule>;
  props?: Record<string, unknown>;
}

export function ForeignRemote({ label, loader, props }: ForeignRemoteProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unmount: Unmount | undefined;

    loader()
      .then((remote) => {
        if (cancelled || !container.current) return;

        if (remote.contract !== SUPPORTED_CONTRACT) {
          throw new Error(
            `Remote "${label}" implements contract ${remote.contract}, host implements ${SUPPORTED_CONTRACT}`,
          );
        }

        unmount = remote.mount(container.current, props);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [loader, props, label]);

  if (failed) {
    return (
      <p role="status" className={`${styles.message} ${styles.failed}`}>
        Unable to load {label}
      </p>
    );
  }

  return <div ref={container} />;
}
