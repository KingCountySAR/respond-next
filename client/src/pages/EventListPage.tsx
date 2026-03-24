import { observer } from 'mobx-react-lite';

import { ToolbarPage } from '@respond/components/ToolbarPage';

export const EventListPage = observer(() => {
  return (
    <ToolbarPage>
      <div>The event list</div>
    </ToolbarPage>
  );
});
