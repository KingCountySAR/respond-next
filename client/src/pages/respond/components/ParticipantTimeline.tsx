import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { MobileDateTimePicker, renderMultiSectionDigitalClockTimeView } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { DomainParticipantUpdate, ParticipantDomainModel } from '@/client/models/participantDomainModel';

type Audit = { name: string; time: number };

export default observer(function ParticipantTimeline({ participant }: { participant: ParticipantDomainModel }) {
  return (
    <Stack spacing={2}>
      {[...participant.timeline]
        .map((update, i) => {
          // Only entries with a server-minted id can be edited; legacy entries are read-only.
          const id = update.id;
          const onChange = id ? (time: number) => participant.updateTimeline({ id, time, status: update.status, organizationId: update.organizationId }) : undefined;
          // Only worth showing when someone other than the participant made the change.
          const editor = update.lastUpdatedBy;
          const audit = editor?.name && editor.id !== participant.id && update.lastUpdatedTime ? { name: editor.name, time: update.lastUpdatedTime } : undefined;
          return <ParticipantUpdateTile key={id ?? i} record={update} onChange={onChange} audit={audit} />;
        })
        .reverse()}
    </Stack>
  );
});

function ParticipantUpdateTile({ record, onChange, audit }: { record: DomainParticipantUpdate; onChange?: (time: number) => void; audit?: Audit }) {
  const initialTime = record.time ?? new Date().getTime(); // Backward Compatability; timelines might have null time values. This ensures a value is present so it can be edited.

  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(initialTime);
  const handleChange = (newTime: Date | null) => {
    if (newTime && !Number.isNaN(newTime.getTime())) {
      setTime(newTime.getTime());
      onChange?.(newTime.getTime());
    }
  };

  const summary = (
    <Stack direction="row" sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <Stack sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h6">{record.statusText}</Typography>
        <Typography variant="caption">{record.organizationName}</Typography>
      </Stack>
      <Stack sx={{ alignItems: 'flex-end' }}>
        <Typography sx={{ ml: 2 }} variant="h6">
          {formatDate(time, 'HHmm')}
        </Typography>
        <Typography variant="caption">{formatDate(time, 'MM/dd')}</Typography>
      </Stack>
    </Stack>
  );

  const auditLine = audit && (
    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', color: 'text.secondary' }}>
      Last Modified By: {audit.name} ({formatDate(audit.time, 'MM/dd HHmm')})
    </Typography>
  );

  if (!onChange) {
    return (
      <Box>
        {summary}
        {auditLine}
      </Box>
    );
  }

  return (
    <Box>
      <ButtonBase sx={{ width: '100%' }} onClick={() => setOpen(true)}>
        {summary}
      </ButtonBase>
      <MobileDateTimePicker
        open={open}
        value={new Date(time)}
        label={`${record.organizationName} - ${record.statusText}`}
        format="MM/dd HH:mm"
        openTo="hours"
        minutesStep={1}
        timeSteps={{ minutes: 1 }}
        viewRenderers={{
          hours: renderMultiSectionDigitalClockTimeView,
          minutes: renderMultiSectionDigitalClockTimeView,
        }}
        onChange={handleChange}
        onClose={() => setOpen(false)}
        slots={{ field: () => null }}
      />
      {auditLine}
    </Box>
  );
}
