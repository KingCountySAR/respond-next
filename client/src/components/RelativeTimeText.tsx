import { differenceInCalendarDays } from 'date-fns';
import * as React from 'react';

import { AbsoluteDateFormat, formatTime } from '@respond/lib/timeFormat';

// Re-exported so existing importers keep resolving these from here; the time
// formatting itself now lives in lib/timeFormat.
export { AbsoluteDateFormat, formatTime };

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
