import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ toast, onDismiss, duration = 3500 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
