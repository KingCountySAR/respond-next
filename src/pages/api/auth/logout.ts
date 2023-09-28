import { withIronSessionApiRoute } from 'iron-session/next';
import { NextApiRequest, NextApiResponse } from 'next';

import { sessionOptions } from '@respond/lib/session';

async function apiLogout(req: NextApiRequest, res: NextApiResponse) {
  req.session.destroy();
  res.json({ status: 'ok' });
}

export default withIronSessionApiRoute(apiLogout, sessionOptions);
