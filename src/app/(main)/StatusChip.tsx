import { Chip } from '@mui/material';
import { Circle } from '@mui/icons-material';
import { ResponderStatus } from '@respond/types/activity';

export const StatusChip = ({ status }: { status: ResponderStatus }) => {

    switch (status) {
        case ResponderStatus.SignedIn:
          return (<Chip
                    icon={<Circle color="success" />}
                    label="Signed In"
                    variant="outlined"
                    size="small"
                  />);
        
        case ResponderStatus.SignedOut:
          return (<Chip
                    icon={<Circle color="error" />}
                    label="Signed Out"
                    variant="outlined"
                    size="small"
                  />);
        
        case ResponderStatus.Standby:
          return (<Chip
                    icon={<Circle color="warning" />}
                    label="Standby"
                    variant="outlined"
                    size="small"
                  />);
        
        case ResponderStatus.Unavailable:
          return (<Chip
                    icon={<Circle color="disabled" />}
                    label="Not Available"
                    variant="outlined"
                    size="small"
                  />);
      }

}