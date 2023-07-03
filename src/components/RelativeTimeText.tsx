import * as React from "react";
import { format as formatDate, formatRelative, Locale } from "date-fns";
import enUS from 'date-fns/locale/en-US';

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
}

export interface RelativeTimeTextProps {
  time: number;
  baseTime: number;
  lowercase?: boolean;
  defaultToTime?: boolean;
}

export const RelativeTimeText = ({ time, baseTime, defaultToTime, lowercase }: RelativeTimeTextProps) => {
  const [ useRelative, setUseRelative ] = React.useState<boolean>(!(defaultToTime ?? false));
  let text;
  if (useRelative) {
    text = formatRelative(time, baseTime, { locale });
    if (!lowercase) {
      text = text[0].toLocaleUpperCase() + text.substring(1);
    }
  } else {
    text = formatDate(time, 'EEE yyyy-MM-dd HHmm');
  }

  return (
    <span onClick={() => setUseRelative(!useRelative)} style={{cursor:'pointer'}}>{text}</span>
  );
}
