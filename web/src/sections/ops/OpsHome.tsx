import AddIcon from '@mui/icons-material/Add';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import NumbersIcon from '@mui/icons-material/Numbers';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import type { ActivityList, ActivityListItem } from '@sync/model';
import { observer, useActivityList } from '@sync/model/react';
import { useSyncClient } from '../../shell/sync';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { useCanCreate } from '../../shell/useCanCreate';
import { ListedUnitChips } from '../../ui/ListedUnitChips';

// Missions 16:9, taller when their unit pills wrap; events 16:5.
const CARD_WIDTH = 320;
const MISSION_HEIGHT = 180;
const EVENT_HEIGHT = 100;
const CARD_GAP_PX = 16;
// Too narrow for two cards side by side (the page's gutters are 24px a side at this width): one centered column.
const ONE_CARD_WIDE = `@media (max-width: ${2 * CARD_WIDTH + CARD_GAP_PX + 2 * 24 - 0.05}px)`;

const byStart = (a: ActivityListItem, b: ActivityListItem) => a.activity!.startTime - b.activity!.startTime;

/** `/ops`: the open missions as cards, newest first, and the other open events below as smaller cards, each opening its dashboard. */
export function OpsHome() {
  const list = useActivityList(useSyncClient());

  useEffect(() => {
    document.title = 'Operations';
  }, []);

  return <ToolbarPage maxWidth={false}>{list ? <OpsHomeContent list={list} /> : <main>Loading…</main>}</ToolbarPage>;
}

const OpsHomeContent = observer(function OpsHomeContent({ list }: { list: ActivityList }) {
  const canCreate = useCanCreate();
  const open = list.activities.filter((a) => a.isActive);
  const missions = open.filter((a) => a.isMission).sort((a, b) => byStart(b, a));
  const events = open.filter((a) => !a.isMission).sort(byStart);

  return (
    // Sections are as tall as their cards, and the page scrolls; missions keep room for two rows.
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>
      <Box component="section" aria-label="Missions">
        <Typography variant="h5" sx={{ mb: 1 }}>
          Missions
        </Typography>
        <Cards minHeight={2 * MISSION_HEIGHT + CARD_GAP_PX}>
          {missions.map((item) => (
            <MissionCard key={item.id} item={item} />
          ))}
          {canCreate.missions && <NewCard href="~/mission/new?then=ops" label="New Mission" height={MISSION_HEIGHT} />}
          {missions.length === 0 && !canCreate.missions && <Typography>No open missions</Typography>}
        </Cards>
      </Box>

      <Box component="section" aria-label="Events">
        <Typography variant="h5" sx={{ mb: 1 }}>
          Events
        </Typography>
        <Cards>
          {events.map((item) => (
            <Card key={item.id} sx={{ width: CARD_WIDTH, height: EVENT_HEIGHT }}>
              <CardActionArea component={Link} href={`~/ops/${item.id}`} sx={{ height: '100%', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                <CardHeading item={item} />
              </CardActionArea>
            </Card>
          ))}
          {canCreate.events && <NewCard href="~/event/new?then=ops" label="New Event" height={EVENT_HEIGHT} />}
          {events.length === 0 && !canCreate.events && <Typography>No open events</Typography>}
        </Cards>
      </Box>
    </Box>
  );
});

/** Cards in rows that wrap; rows keep to their cards' height even when `minHeight` leaves room below. */
function Cards({ children, minHeight }: { children: ReactNode; minHeight?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: `${CARD_GAP_PX}px`, minHeight, [ONE_CARD_WIDE]: { justifyContent: 'center' } }}>
      {children}
    </Box>
  );
}

/** The last card in a row: opens the New form, then the new activity's dashboard. */
function NewCard({ href, label, height }: { href: string; label: string; height: number }) {
  return (
    <Card variant="outlined" sx={{ width: CARD_WIDTH, minHeight: height, borderStyle: 'dashed' }}>
      <CardActionArea component={Link} href={href} sx={{ height: '100%', display: 'flex', gap: 1 }}>
        <AddIcon sx={{ fontSize: 32 }} color="action" />
        <Typography variant="h6">{label}</Typography>
      </CardActionArea>
    </Card>
  );
}

const MissionCard = observer(function MissionCard({ item }: { item: ActivityListItem }) {
  return (
    <Card sx={{ width: CARD_WIDTH, minHeight: MISSION_HEIGHT }}>
      <CardActionArea component={Link} href={`~/ops/${item.id}`} sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <CardHeading item={item} />
        <Box sx={{ flexGrow: 1 }} />
        <ListedUnitChips item={item} sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 0.5, mt: 1 }} />
      </CardActionArea>
    </Card>
  );
});

/** A card's three lines: state number and start date, title, location. */
const CardHeading = observer(function CardHeading({ item }: { item: ActivityListItem }) {
  const a = item.activity!;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', '& svg': { fontSize: 16 } }}>
        {a.idNumber && (
          <>
            <NumbersIcon titleAccess="State number" />
            <Typography variant="body2" noWrap sx={{ mr: 1.5 }}>
              {a.idNumber}
            </Typography>
          </>
        )}
        <CalendarTodayOutlinedIcon titleAccess="Start date" />
        <Typography variant="body2" noWrap>
          {formatDate(a.startTime, 'EEE MM/dd/yy')}
        </Typography>
      </Box>
      <Typography variant="h6" noWrap sx={{ fontWeight: 'bold', lineHeight: 1.3 }}>
        {a.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap>
        {a.location.title}
      </Typography>
    </>
  );
});
