/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentType, createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import AlertDialog, { AlertDialogOptions } from './AlertDialog';
import ConfirmDialog, { ConfirmDialogOptions } from './ConfirmDialog';

// Props that every MUI dialog component will receive automatically
export interface MuiDialogProps<T = unknown> {
  open: boolean;
  onClose: (result: T | null) => void;
}

interface DialogItem<T = unknown, P = any> {
  id: string;
  Component: ComponentType<P>;
  props: Omit<P, keyof MuiDialogProps<any>>;
  resolve: (value: T | null) => void;
}

interface DialogsContextType {
  open: <P extends MuiDialogProps<any>, T = P extends MuiDialogProps<infer U> ? U : never>(Component: ComponentType<P>, props: Omit<P, keyof MuiDialogProps<any>>) => Promise<T | null>;
  close: (id: string, result?: unknown) => void;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean | null>;
  alert: (options: AlertDialogOptions | string) => Promise<void>;
}

const DialogsContext = createContext<DialogsContextType | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogItem<any, any>[]>([]);
  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;

  const close = useCallback((id: string, result: unknown = null) => {
    setDialogs((prev) => {
      const dialog = prev.find((d) => d.id === id);
      if (dialog) dialog.resolve(result);
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const open = useCallback(<P extends MuiDialogProps<any>, T = P extends MuiDialogProps<infer U> ? U : never>(Component: ComponentType<P>, props: Omit<P, keyof MuiDialogProps<any>>): Promise<T | null> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);

      window.history.pushState({ dialogId: id }, '');

      setDialogs((prev) => [
        ...prev,
        {
          id,
          Component: Component as ComponentType<any>,
          props: (props || {}) as Omit<P, keyof MuiDialogProps<any>>,
          resolve: resolve as (value: unknown) => void,
        },
      ]);
    });
  }, []);

  // Sync with Browser Back / Forward Button
  useEffect(() => {
    const handlePopState = () => {
      const currentDialogs = dialogsRef.current;
      if (currentDialogs.length === 0) return;

      const topDialog = currentDialogs[currentDialogs.length - 1];

      setDialogs((prev) => {
        const dialog = prev.find((d) => d.id === topDialog.id);
        if (dialog) dialog.resolve(null);
        return prev.filter((d) => d.id !== topDialog.id);
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Cleanup history stack on manual closing (UI button / backdrop / ESC)
  const closeAndPopHistory = useCallback(
    (id: string, result: unknown = null) => {
      const isTop = dialogsRef.current[dialogsRef.current.length - 1]?.id === id;

      close(id, result);

      if (isTop && window.history.state?.dialogId === id) {
        window.history.back();
      }
    },
    [close],
  );

  const confirm = useCallback(
    (options: ConfirmDialogOptions) => {
      return open(ConfirmDialog, options);
    },
    [open],
  );

  const alert = useCallback(
    async (options: AlertDialogOptions | string) => {
      const props = typeof options === 'string' ? { message: options } : options;
      return open(AlertDialog, props).then(() => undefined);
    },
    [open],
  );

  return (
    <DialogsContext.Provider value={{ open, close: closeAndPopHistory, alert, confirm }}>
      {children}
      {dialogs.map(({ id, Component, props }) => (
        <Component key={id} {...props} open={true} onClose={(result: unknown) => closeAndPopHistory(id, result)} />
      ))}
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsContextType {
  const context = useContext(DialogsContext);
  if (!context) {
    throw new Error('useDialogs must be used within a DialogProvider');
  }
  return context;
}
