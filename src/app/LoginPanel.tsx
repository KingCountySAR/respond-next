'use client';

import { Box, Button, Stack } from '@respond/components/Material';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import Api from '@respond/lib/api';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';
import { OrgActions } from '@respond/lib/client/store/organization'
import { AuthResponse } from '@respond/types/authResponse'
import { useState } from 'react'
import { AuthError } from '@respond/lib/apiErrors'
import { Alert, AlertTitle } from '@mui/material'

export default function LoginPanel() {
  const { noExternalNetwork } = useAppSelector(state => state.config.dev );
  const dispatch = useAppDispatch();
  let [error, setError] = useState("");
  let [errorDetails, setErrorDetails] = useState("");

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
    console.log('login response', res);

    if (res.userInfo) {
      localStorage.userAuth = JSON.stringify(res.userInfo);
      dispatch(AuthActions.set({ userInfo: res.userInfo }));
      dispatch(OrgActions.set({ mine: res.organization }));
    } else {
      switch (res.error) {
        case AuthError.USER_NOT_KNOWN:
          setError("Could not find email address in D4H");
          setErrorDetails("Please contact your unit's database manager to have your email address added to your D4H profile, or log in with an email address in your profile.");
          break;
        
        default:
          setError("Error logging in" + (res.error ? ` - ${res.error}` : ""));
          setErrorDetails("Please try again. If you continue encountering this error, please contact support.");
          break;
      }
      
    }

    return res;
  }

  return (
    <Box sx={{flexGrow: 1, display: 'flex', justifyContent:'center'}}>
      {noExternalNetwork
      ? <Button onClick={doOfflineLogin}>offline login</Button>
      : <Stack spacing={2}>
          { error && <Alert severity="error">
            <AlertTitle>{error}</AlertTitle>
            {errorDetails}
          </Alert> }

          <GoogleLogin
            onSuccess={doLogin}
            onError={() => console.log('Google error')}
          />
        </Stack>
      }
    </Box>
  )
}