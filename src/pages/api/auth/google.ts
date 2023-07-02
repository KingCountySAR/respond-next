import { sessionOptions } from '@respond/lib/session';
import { withIronSessionApiRoute } from 'iron-session/next';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServices } from '@respond/lib/server/services';
import * as Mongo from '@respond/lib/server/mongodb';
import * as Auth from '@respond/lib/server/auth';
import { MemberProvider } from '@respond/lib/server/memberProviders/memberProvider';
import { TokenPayload } from 'google-auth-library';
import { AuthResponse } from '@respond/types/authResponse'
import { AuthError } from '@respond/lib/apiErrors'

async function apiLogin(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({message: 'Login requires POST'});
    return;
  }

  let memberProvider: MemberProvider|undefined = undefined;
  try {
    let payload: TokenPayload|undefined;
    if (process.env.DEV_NETWORK_DISABLED) {
      const data = process.env.DEV_AUTH_USER ?? '{}';
      console.log('login data', data);
      payload = JSON.parse(data);
    } else {
      const { token } = req.body;
      const authClient = (await getServices()).authClient;

      const ticket = await authClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_ID,
      });

      payload = ticket.getPayload();
    }
    
    if (!payload) {
      res.status(500).json({error: AuthError.NO_TICKET});
      return;
    }

    if (!payload.email) {
      res.status(500).json({error: AuthError.NO_EMAIL});
      return;
    }

    const domain = req.headers.host?.split(':')[0] ?? '';
    const organization = await Mongo.getOrganizationForDomain(domain);
    if (!organization) {
      console.log(`${payload.email} trying to login with unknown domain ${domain}`);
      res.status(403).json({error: AuthError.INVALID_DOMAIN});
      return;
    }

    memberProvider = (await getServices()).memberProviders.get(organization.memberProvider?.provider);
    if (!memberProvider) {
      console.log(`Can't find memberProvider for org ${organization.id}: ${organization.memberProvider?.provider}`);
      res.status(500).json({error: AuthError.INVALID_CONFIGURATION});
      return;
    }

    const authInfo = {
      provider: 'google',
      email: payload.email,
    };
    
    const memberInfo = await memberProvider.getMemberInfo(organization.id, authInfo, organization.memberProvider);
    if (!memberInfo) {
      res.status(403).json({error: AuthError.USER_NOT_KNOWN });
      return;
    }

    req.session.auth = {
      email: payload.email,
      userId: memberInfo.id,
      organizationId: organization.id,
      groups: memberInfo.groups,
      isSiteAdmin: false,
      ...payload,
    };

    console.log(`Logging in user ${payload.email}`);
    await req.session.save();

    const userInfo = Auth.userFromAuth(req.session.auth)
    const responseBody: AuthResponse = {
      userInfo,
      organization: userInfo ? organization : undefined
    }

    res.json(responseBody);
  } catch (error) {
    res.status(500).json({error: (error as Error).message });
  }
  
  res.end();
  memberProvider?.refresh();
}

export default withIronSessionApiRoute(apiLogin, sessionOptions);