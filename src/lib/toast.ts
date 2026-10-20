export interface ToastItem {
  id: string;
  message: string;
  kind: "ok" | "info" | "nudge";
}

type Listener = (toasts: ToastItem[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];

function emit() {
  for (const l of listeners) l(toasts);
}

export function showToast(message: string, kind: ToastItem["kind"] = "nudge") {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => dismissToast(id), 4500);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}
