import { Button, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';

/**
 * The legacy home page lists My Activity, Missions and Events. Those lists need the server's
 * activity summaries, which aren't built yet, so for now an activity is opened by its id.
 */
export function Home() {
  const [, navigate] = useLocation();
  const [id, setId] = useState('');

  useEffect(() => {
    document.title = 'Event list';
  }, []);

  return (
    <ToolbarPage>
      <main>
        <Placeholder title="Missions and Events" comesWith="activity summaries on the server">
          <Stack
            direction="row"
            spacing={1}
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (id.trim()) navigate(`/mission/${encodeURIComponent(id.trim())}`);
            }}
          >
            <TextField size="small" label="Activity id" value={id} onChange={(e) => setId(e.target.value)} />
            <Button type="submit" variant="outlined">
              Open
            </Button>
          </Stack>
        </Placeholder>
      </main>
    </ToolbarPage>
  );
}
