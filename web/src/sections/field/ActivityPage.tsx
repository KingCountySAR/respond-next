import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect } from 'react';
import { observer, useFieldActivity } from '@sync/model/react';
import { useRosterState } from './components/RosterPanel';
import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = observer(function ActivityPage() {
  const activity = useFieldActivity();
  const roster = useRosterState();
  const rec = activity.record;
  const numberAndTitle = rec ? `${rec.idNumber} ${rec.title}` : '';

  useEffect(() => {
    document.title = numberAndTitle;
  }, [numberAndTitle]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!rec) return <div>Loading activity...</div>;

  return isMobile ? <MobileActivityPage activity={activity} roster={roster} /> : <DesktopActivityPage activity={activity} roster={roster} />;
});
