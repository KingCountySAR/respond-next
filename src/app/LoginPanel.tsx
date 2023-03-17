'use client';

import { Button } from '@mui/material';
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import Api from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';

async function doLogin(data: CredentialResponse) {
  if (!data || !data.credential) {
    throw new Error('login error');
  }
  return await finishLogin(data.credential);
}

async function doOfflineLogin() {
  return await finishLogin('');
}

async function finishLogin(token: string) {
  const res = await Api.post<any>('/api/auth/google', { token });
  localStorage.userAuth = JSON.stringify(res);

  console.log('login response', res);
  return res;
}

export default function LoginPanel() {
  const { noExternalNetwork } = useAppSelector(state => state.config.dev );

  return (<>
    {noExternalNetwork
    ?<Button onClick={doOfflineLogin}>offline login</Button>
    : <GoogleLogin
        onSuccess={doLogin}
        onError={() => console.log('Google error')}
      />
    }
    <button onClick={() => fetch('/api/auth/logout')}>logout</button>
  </>
  )
}