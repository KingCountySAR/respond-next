// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button, DialogActions } from '@mui/material';
import { DialogProvider, useDialogs, type MuiDialogProps } from '../src/shell/dialogs';
import { AppDialog } from '../src/shell/dialogs/AppDialog';

/** A dialog whose Delete closes it, then asks to confirm, as a team's edit dialog does. */
function EditDialog({ onClose, onDeleted }: MuiDialogProps<null> & { onDeleted: (confirmed: boolean | null) => void }) {
  const dialogs = useDialogs();
  const remove = async () => {
    onClose(null);
    onDeleted(await dialogs.confirm({ prompt: 'Delete Team 1?', label: 'Delete', destructive: true }));
  };
  return (
    <AppDialog open onClose={onClose}>
      <DialogActions>
        <Button onClick={() => void remove()}>Remove</Button>
      </DialogActions>
    </AppDialog>
  );
}

function Opener({ onDeleted }: { onDeleted: (confirmed: boolean | null) => void }) {
  const dialogs = useDialogs();
  return <Button onClick={() => void dialogs.open(EditDialog, { onDeleted })}>Edit</Button>;
}

// A real browser tells the page about history.back() a while later, not before the next dialog opens.
const back = window.history.back.bind(window.history);
beforeEach(() => {
  vi.spyOn(window.history, 'back').mockImplementation(() => void setTimeout(back, 30));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('dialogs', () => {
  it('opened as another closes, survive the late history pop', async () => {
    const onDeleted = vi.fn();
    render(
      <DialogProvider>
        <Opener onDeleted={onDeleted} />
      </DialogProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Delete Team 1?')).toBeTruthy();
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(screen.getByText('Delete Team 1?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(true));
  });

  it('still close on the browser Back', async () => {
    const onDeleted = vi.fn();
    render(
      <DialogProvider>
        <Opener onDeleted={onDeleted} />
      </DialogProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeTruthy();
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull());
  });
});
