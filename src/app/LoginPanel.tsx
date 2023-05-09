'use client';

import { Button } from '@mui/material';
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import Api from '@respond/lib/api';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';
import { OrgActions } from '@respond/lib/client/store/organization'
import { AuthResponse } from '@respond/types/authResponse'

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
    const res = await Api.post<any>('/api/auth/google', { token }) as AuthResponse;
    localStorage.userAuth = JSON.stringify(res.userInfo);
  
    console.log('login response', res);
    dispatch(AuthActions.set({ userInfo: res.userInfo }));
    dispatch(OrgActions.set({ mine: res.organization }))
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