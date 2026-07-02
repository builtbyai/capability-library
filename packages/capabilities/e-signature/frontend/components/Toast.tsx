import * as React from 'react';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastContainerProps {
  toasts: Toast[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="esig-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`esig-toast ${t.kind}`}>{t.message}</div>
      ))}
    </div>
  );
}

/** Headless hook for toast state. Consumers render with <ToastContainer />. */
export function useToasts(autoDismissMs = 3000) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, autoDismissMs);
  }, [autoDismissMs]);

  return { toasts, push };
}
