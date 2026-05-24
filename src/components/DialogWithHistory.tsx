import Dialog, { DialogProps } from '@mui/material/Dialog';
import { useMemo } from 'react';

import useDialogHistory from '@respond/hooks/useDialogHistory';

export default function DialogWithHistory(props: DialogProps) {
  const { open, onClose, ...other } = props;

  const historyClose = useMemo(
    () => () => {
      if (onClose) {
        onClose({} as object, 'backdropClick');
      }
    },
    [onClose],
  );

  useDialogHistory(!!open && !!onClose, historyClose);

  return <Dialog open={open} onClose={onClose} {...other} />;
}
