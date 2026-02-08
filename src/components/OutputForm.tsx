import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Grid, Typography } from '@mui/material';
import Link from 'next/link';
import React, { Children, ReactNode, useEffect, useRef, useState } from 'react';

import { RelativeStyle, RelativeTimeText } from './RelativeTimeText';

const DEFAULT_LINE_HEIGHT_PIXELS = 24;

export const OutputForm = ({ children, columns }: { children: ReactNode; columns?: number }) => {
  const childrenArray = Children.toArray(children);

  const outputFields = childrenArray.map((child, index) => {
    return (
      <Grid key={index} item xs={12} sm={12 / (columns ?? 1)}>
        {child}
      </Grid>
    );
  });

  return (
    <Grid container columnSpacing={2}>
      {outputFields.length && outputFields}
    </Grid>
  );
};

const OutputField = ({ label, multiline, children }: { label: string; multiline?: boolean; children: React.ReactNode }) => {
  const flexDirection = multiline ? 'column' : 'Row';
  const alignItems = multiline ? 'start' : 'center';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { flexDirection },
        alignItems: { alignItems },
        justifyContent: 'space-between',
        borderColor: 'grey.200',
      }}
      borderBottom={1}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: '2em', mr: { xs: 2, md: 5 } }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
};

const OutputShowMore = ({ children, rows }: { children: ReactNode; rows?: number }) => {
  const rowLimit = Math.max(rows ?? 0, 0);
  const collapsedHeightPixels = DEFAULT_LINE_HEIGHT_PIXELS * rowLimit;

  const contentElement = useRef<HTMLDivElement>(null);
  const isCollapsible = useRef<boolean>(false);

  useEffect(() => {
    isCollapsible.current = !!collapsedHeightPixels && !!contentElement.current && collapsedHeightPixels < contentElement.current.offsetHeight;
    setCollapse(isCollapsible.current);
  }, [collapsedHeightPixels]);

  const [collapse, setCollapse] = useState<boolean>(false);
  const handleClick = () => {
    if (!isCollapsible.current) {
      return;
    }
    setCollapse(!collapse);
  };

  const linesToShow = collapse && rowLimit ? rowLimit : undefined;
  const cursorStyle = isCollapsible.current ? 'pointer' : 'default';

  return (
    <>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: linesToShow && `${linesToShow}lh`,
          cursor: cursorStyle,
        }}
        onClick={handleClick}
        ref={contentElement}
      >
        {children}
      </div>
      {isCollapsible.current && (
        <div onClick={handleClick} style={{ cursor: 'pointer' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Typography variant="caption">{collapse ? 'show more' : 'show less'}</Typography>
            {collapse && <ExpandMoreIcon fontSize="small" />}
            {!collapse && <ExpandLessIcon fontSize="small" />}
          </Box>
        </div>
      )}
    </>
  );
};

export const OutputText = ({ label, value }: { label: string; value?: string }) => {
  return <OutputField label={label}>{value !== undefined && <Typography variant="body1">{value}</Typography>}</OutputField>;
};

export const OutputTextArea = ({ label, value, rows }: { label: string; value?: string; rows?: number }) => {
  return (
    <OutputField label={label} multiline>
      <OutputShowMore rows={rows}>
        {value !== undefined &&
          value.split('\n').map((v, i) => {
            if (v === '') {
              return (
                <Typography key={i}>
                  <br />
                </Typography>
              );
            }
            return (
              <Typography key={i} variant="body1">
                {v}
              </Typography>
            );
          })}
      </OutputShowMore>
    </OutputField>
  );
};

export const OutputLink = ({ label, value, href, target }: { label: string; value?: string; href?: string; target?: '_blank' | '_parent' | '_self' | '_top' }) => {
  return (
    <OutputField label={label}>
      {value !== undefined && (
        <Link href={href ?? '#'} target={target ?? '_blank'}>
          {value}
        </Link>
      )}
    </OutputField>
  );
};

// eslint-disable-next-line prettier/prettier
const escapeHtml = (str: string) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const linkifyEscaped = (str: string) => {
  const urlRegex = /(\bhttps?:\/\/[^\s<>]+|\bwww\.[^\s<>]+)/gi;
  return str.replace(urlRegex, (url) => {
    let href = url;
    if (!/^https?:\/\//i.test(href)) {
      href = 'http://' + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
};

const sanitizeAndLinkify = (input: string) => {
  if (!input) return '';
  const escaped = escapeHtml(input);
  const linked = linkifyEscaped(escaped);
  return linked.replace(/\n/g, '<br/>');
};

export const OutputLinkified = ({ label, value, rows }: { label: string; value?: string; rows?: number }) => {
  const html = value ? sanitizeAndLinkify(value) : undefined;
  console.log(html);
  return (
    <OutputField label={label} multiline>
      <OutputShowMore rows={rows}>{html && <div dangerouslySetInnerHTML={{ __html: html }} />}</OutputShowMore>
    </OutputField>
  );
};

export const OutputTime = ({ label, time, relative = RelativeStyle.Absolute }: { label: string; time?: number; relative?: RelativeStyle }) => {
  const [nowTime, setNowTime] = useState<number>(new Date().getTime());

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date().getTime()), 5000);
    return () => {
      clearInterval(interval);
    };
  });

  return <OutputField label={label}>{time && <RelativeTimeText time={time} baseTime={nowTime} relative={relative} />}</OutputField>;
};
