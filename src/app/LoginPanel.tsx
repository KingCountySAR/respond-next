'use client';

import { Button } from '@mui/material';
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import Api from '@respond/lib/api';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';

export default function LoginPanel() {
  const { noExternalNetwork } = useAppSelector(state => state.config.dev );
  const dispatch = useAppDispatch();

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
    dispatch(AuthActions.set({ userInfo: res }));
    return res;
  }

  return (<>
    {noExternalNetwork
    ?<Button onClick={doOfflineLogin}>offline login</Button>
    : <GoogleLogin
        onSuccess={doLogin}
        onError={() => console.log('Google error')}
      />
    }
    <button onClick={() => dispatch(AuthActions.logout())}>logout</button>
  </>
  )
}