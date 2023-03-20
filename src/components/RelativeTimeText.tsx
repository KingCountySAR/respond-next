import * as React from "react";
import { format as formatDate, formatRelative } from "date-fns";

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
    text = formatRelative(time, baseTime);
    if (!lowercase) {
      text = text[0].toLocaleUpperCase() + text.substring(1);
    }
  } else {
    text = formatDate(time, 'EEE yyyy-MM-dd HH:mm');
  }

  return (
    <span onClick={() => setUseRelative(!useRelative)} style={{cursor:'pointer'}}>{text}</span>
  );
}
