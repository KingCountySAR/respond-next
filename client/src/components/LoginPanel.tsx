import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useAuthContext } from '@respond/lib/authProvider';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void,
          renderButton: (el: HTMLElement, config: object) => void,
        }
      }
    }
  }
}

export const LoginPanel = observer(() => {
  const auth = useAuthContext();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      auth.setupButton(ref.current);
    }
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center'}}>
      <div ref={ref} id="google-signin-btn" /> {auth.working ? '...' : ''}
    </div>
  )
});