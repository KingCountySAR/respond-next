import { sessionOptions } from '@respond/lib/session';
import { withIronSessionApiRoute } from 'iron-session/next';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServices } from '@respond/lib/server/services';
import * as Mongo from '@respond/lib/server/mongodb';
import * as Auth from '@respond/lib/server/auth';
import { MemberProvider } from '@respond/lib/server/memberProviders/memberProvider';
import { TokenPayload } from 'google-auth-library';

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
      const authClient = getServices().authClient;

      const ticket = await authClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_ID,
      });

      payload = ticket.getPayload();
    }
    
    if (!payload) {
      res.status(500).json({message: 'Could not get ticket'});
      return;
    }
    if (!payload.email) {
      res.status(500).json({message: 'Could not get user email'});
      return;
    }

    const domain = req.headers.host?.split(':')[0] ?? '';
    const organization = await Mongo.getOrganizationForDomain(domain);
    if (!organization) {
      console.log(`${payload.email} trying to login with unknown domain ${domain}`);
      res.status(403).json({message: 'Invalid domain'});
      return;
    }

    memberProvider = getServices().memberProviders.get(organization.memberProvider?.provider);
    if (!memberProvider) {
      console.log(`Can't find memberProvider for org ${organization.id}: ${organization.memberProvider?.provider}`);
      res.status(500).json({message: 'Invalid configuration'});
      return;
    }

    const authInfo = {
      provider: 'google',
      email: payload.email,
    };
    const memberInfo = await memberProvider.getMemberInfo(organization.id, authInfo, organization.memberProvider);
    if (!memberInfo) {
      res.status(403).json({error: 'User not known' });
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
    res.json(Auth.userFromAuth(req.session.auth));
  } catch (error) {
    res.status(500).json({message: (error as Error).message });
  }
  res.end();
  memberProvider?.refresh();
}

export default withIronSessionApiRoute(apiLogin, sessionOptions);