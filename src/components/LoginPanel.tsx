'use client';

import { Alert, AlertTitle } from '@mui/material';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';

import { Box, Button, Stack } from '@respond/components/Material';
import Api from '@respond/lib/api';
import { AuthError } from '@respond/lib/apiErrors';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';
import { OrgActions } from '@respond/lib/client/store/organization';
import { AuthResponse } from '@respond/types/authResponse';
import { MemberProviderName } from '@respond/types/data/MemberProviderType';

export default function LoginPanel() {
  const { noExternalNetwork } = useAppSelector((state) => state.config.dev);
  const dispatch = useAppDispatch();
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

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
    const res = await Api.postBody<{ token: string }, AuthResponse>('/api/auth/google', { token });
    console.log('login response', res);

    if (res.userInfo) {
      localStorage.userAuth = JSON.stringify(res.userInfo);
      dispatch(AuthActions.set({ userInfo: res.userInfo }));
      dispatch(OrgActions.set({ mine: res.organization }));
    } else {
      const organization = res.organization;
      let supportContact: string | undefined = undefined;
      let memberProviderName = undefined;

      if (organization) {
        supportContact = organization.supportEmail;
        memberProviderName = MemberProviderName[organization.memberProvider];
      }

      supportContact ??= "your unit's system administrator";

      switch (res.error) {
        case AuthError.USER_NOT_KNOWN:
          if (memberProviderName) {
            setError(`Could not find your email address in ${memberProviderName}`);
            setErrorDetails(`Please log in with an email address in your ${memberProviderName} profile. If your email address is not in your profile, contact ${supportContact} for support.`);
          } else {
            setError('Could not find your email address');
            setErrorDetails(`Please log in with an authorized email address or contact ${supportContact} for support.`);
          }
          break;

        default:
          setError('Error logging in' + (res.error ? ` - ${res.error}` : ''));
          setErrorDetails(`Please try again. If you continue encountering this error, contact ${supportContact}.`);
          break;
      }
    }

    return res;
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
      {noExternalNetwork ? (
        <Button onClick={doOfflineLogin}>offline login</Button>
      ) : (
        <Stack spacing={2}>
          {error && (
            <Alert severity="error">
              <AlertTitle>{error}</AlertTitle>
              {errorDetails}
            </Alert>
          )}

          <GoogleLogin onSuccess={doLogin} onError={() => console.log('Google error')} />
        </Stack>
      )}
    </Box>
  );
}
