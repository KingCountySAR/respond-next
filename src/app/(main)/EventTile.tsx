import { Card, CardActionArea, CardActions, CardContent, Typography } from "@mui/material";
import { Activity } from '@respond/types/activity';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { getActiveParticipants, isActive, getActivityPath } from '@respond/lib/client/store/activities';
import Link from 'next/link';

export const EventTile = ({ activity }: { activity: Activity }) => {

    return (
        <Card key={activity.id}>
            <CardActionArea component={Link} href={getActivityPath(activity)}>
                <CardContent>
                    <Typography gutterBottom variant="h5" component="div">
                        {activity.idNumber} {activity.title}
                    </Typography>
                    <Typography>
                        Active Responders:{" "}
                        {getActiveParticipants(activity).length}
                    </Typography>
                </CardContent>
            </CardActionArea>
            {isActive(activity) && (
                <CardActions>
                    <StatusUpdater activity={activity} />
                </CardActions>
            )}
        </Card>
    );
    
};