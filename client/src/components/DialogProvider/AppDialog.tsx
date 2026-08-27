/**
 * A wrapper around Material UI's `<Dialog>` component designed for promise-based dialog workflows.
 *
 * ### Why use this wrapper?
 * 1. **Signature Adapter:** MUI's `Dialog.onClose` emits `(event, reason)`, whereas promise-based dialogs
 *    expect `onClose(result)`. This component intercepts MUI closing events and adapts them.
 * 2. **Automated Dismissal Handling:** Intercepts backdrop clicks and `ESC` key presses (`'backdropClick'`,
 *    `'escapeKeyDown'`) and automatically calls `onClose(null)`, distinguishing user dismissals from
 *    explicit form submissions or action button selections.
 * 3. **Eliminates Boilerplate:** Prevents custom dialog components from needing to reimplement
 *    `handleMuiClose` event inspection logic individually.
 *
 * @template T - The return value type expected when the dialog resolves.
 * @example
 * ```tsx
 * export default function MyCustomDialog({ open, onClose }: MuiDialogProps<string>) {
 *   return (
 *     <AppDialog onClose="{onClose}" open="{open}">
 *       <DialogContent>Enter something...</DialogContent>
 *       <DialogActions>
 *         <Button onClick="{()"> onClose('Submit Value')}>Submit</Button>
 *       </DialogActions>
 *     </AppDialog>
 *   );
 * }
 * ```
 */

import { DialogProps } from '@mui/material';

import { Dialog } from '../Material';

import { MuiDialogProps } from '.';

export interface AppDialogProps<T> extends Omit<DialogProps, 'onClose'> {
  onClose: MuiDialogProps<T>['onClose'];
}

export function AppDialog<T>({ open, onClose, children, ...rest }: AppDialogProps<T>) {
  const handleMuiClose = (_: object, reason?: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      onClose(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleMuiClose} {...rest}>
      {children}
    </Dialog>
  );
}
