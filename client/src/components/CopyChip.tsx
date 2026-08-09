import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Chip, { ChipProps } from '@mui/material/Chip';
import React, { useEffect, useRef, useState } from 'react';

export interface CopyChipProps extends Omit<ChipProps, 'label' | 'onClick'> {
  /** The value to copy to the clipboard and display */
  value: string;
  /** Optional custom label to show when in the default state */
  label?: React.ReactNode;
  /** Duration in milliseconds to display the copied state (default: 3000) */
  timeoutDuration?: number;
  /** Optional callback after click */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const CopyChip: React.FC<CopyChipProps> = ({ value, label, timeoutDuration = 3000, onClick, color, sx, ...restProps }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the timeout if the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    try {
      await navigator.clipboard.writeText(value);

      setCopied(true);

      // Reset timer if clicked again while already in "copied" state
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, timeoutDuration);
    } catch (err) {
      console.error('Failed to copy text to clipboard:', err);
    }

    if (onClick) {
      onClick(event);
    }
  };

  return <Chip {...restProps} label={copied ? `${value} copied` : (label ?? value)} color={copied ? 'success' : (color ?? 'default')} icon={copied ? <CheckIcon /> : <ContentCopyIcon />} onClick={handleClick} sx={[{ px: 1, mt: 1 }, ...(Array.isArray(sx) ? sx : [sx])]} clickable />;
};
