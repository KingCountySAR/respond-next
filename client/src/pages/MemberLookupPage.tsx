import { MemberInfo, MemberListResult } from '@app/shared';
import { Card, CardContent, FormControl, FormHelperText, Stack, TextField, Typography } from '@mui/material';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useDebounce } from '@respond/hooks/useDebounce';
import { useEffect, useState } from 'react';

export const MemberLookupPage = () => {
  const [query, setQuery] = useState<string>('');
  const [matches, setMatches] = useState<MemberInfo[]>([]);
  const debouncedQuery = useDebounce(query, 100);

  useEffect(() => {
    fetch('/api/members/search?q=' + encodeURIComponent(debouncedQuery))
      .then(response => response.json() as Promise<MemberListResult>)
      .then(json => {
        console.log('got response', json);
        setMatches(json.result);
      });
  }, [debouncedQuery]);

  return (
    <ToolbarPage>
      <Typography>Lookup members:</Typography>
      <FormControl fullWidth>
        <TextField variant="outlined" label="Search" value={query} onChange={evt => setQuery(evt.target.value)} />
        <FormHelperText></FormHelperText>
      </FormControl>
      {matches.length ? (
        <Stack gap={2}>
          {matches.map(m => (
            <Card key={m.id}>
              <CardContent>
                <Typography>{m.firstname} {m.lastname}</Typography>
                <img style={{ height: '6em', border: 'solid 1px #999', borderRadius: 4 }} src={`/api/members/${m.id}/photo`} />
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Typography>No matches</Typography>
      )}
    </ToolbarPage>
  );
};
