'use client';

import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import Api from '@respond/lib/api';

async function doLogin(data: CredentialResponse) {
  if (!data || !data.credential) {
    throw new Error('login error');
  }

  const res = await Api.post<any>('/api/auth/google', { token: data.credential });
  localStorage.userAuth = JSON.stringify(res);

  console.log('login response', res);
  return res;
}

export default function LoginPanel() {
  return (<>
    <GoogleLogin
    onSuccess={doLogin}
    onError={() => console.log('Google error')}
  />
  <button onClick={() => fetch('/api/auth/logout')}>logout</button>
  </>
  )
}