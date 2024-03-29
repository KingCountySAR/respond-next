import { format as formatDate, formatRelative, Locale } from 'date-fns';
import { differenceInCalendarDays } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import * as React from 'react';

// Default time formatting for formatRelative is 12 hour time. We want 24 hour time.
// To do this, we need to provide a custom locale. This GitHub comment shows the general approach:
// https://github.com/date-fns/date-fns/issues/1218#issuecomment-599182307
//
// The default formatRelativeLocale for enUS can be found here:
// https://github.com/date-fns/date-fns/blob/main/src/locale/en-US/_lib/formatRelative/index.ts
//
// That was copied and tweaked below to display 24 hour time.
const formatRelativeLocale: Record<string, string> = {
  lastWeek: "'last' eeee 'at' HHmm",
  yesterday: "'yesterday at' HHmm",
  today: "'today at' HHmm",
  tomorrow: "'tomorrow at' HHmm",
  nextWeek: "eeee 'at' HHmm",
  other: 'P',
};

const locale: Locale = {
  ...enUS,
  formatRelative: (token) => formatRelativeLocale[token],
};

export const AbsoluteDateFormat: string = 'EEE yyyy-MM-dd HHmm';
export const TextBoxDateFormat: string = "yyyy-MM-dd'T'HH:mm";

export enum RelativeStyle {
  Relative,
  Auto,
  Absolute,
}

export interface RelativeTimeTextProps {
  time: number;
  baseTime?: number;
  lowercase?: boolean;
  relative?: RelativeStyle;
}

export const formatTime = (time: number, baseTime: number = new Date().getTime(), isRelative?: boolean, lowercase?: boolean) => {
  let text;
  if (isRelative) {
    text = formatRelative(time, baseTime, { locale });
    if (!lowercase) {
      text = text[0].toLocaleUpperCase() + text.substring(1);
    }
  } else {
    text = formatDate(time, AbsoluteDateFormat);
  }
  return text;
};

export const RelativeTimeText = ({ time, baseTime = new Date().getTime(), relative = RelativeStyle.Absolute, lowercase }: RelativeTimeTextProps) => {
  let isRelativeDefault = relative == RelativeStyle.Relative;
  if (relative == RelativeStyle.Auto && time) {
    // If the time is within 1 day of today, use relative time.
    const dateDiff = differenceInCalendarDays(new Date(), new Date(time));
    if (Math.abs(dateDiff) <= 1) isRelativeDefault = true;
  }

  const [isRelative, setIsRelative] = React.useState<boolean>(isRelativeDefault);
  const text = formatTime(time, baseTime, isRelative, lowercase);

  return (
    <span onClick={() => setIsRelative(!isRelative)} style={{ cursor: 'pointer' }}>
      {text}
    </span>
  );
};
