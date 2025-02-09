// import type { Socket as NetSocket } from 'net';

// // // import { withIronSessionApiRoute } from 'iron-session/next';
// import type { NextApiRequest, NextApiResponse } from 'next';

// // // import { getAuthFromApiCookies } from '@respond/lib/server/auth';
// // import { getServices } from '@respond/lib/server/services';
// import { auth } from '@respond/auth';
// import type { SocketHTTPServer } from '@respond/lib/server/socketManager';
// // // import { sessionOptions } from '@respond/lib/session';

// interface NextSocketApiResponse extends NextApiResponse {
//   socket: NetSocket & {
//     server: SocketHTTPServer;
//   };
// }

// function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
//   return 'socket' in object;
// }

// async function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
//   const session = await auth();
//   console.log('SocketHandler', session);

//   if (hasHttpServer(res)) {
//     console.log('hasHttpServer');
//   }

//   res.json({
//     key: 'blah-key',
//   });
// }

// export default SocketHandler;

// // async function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
// //   const socketManager = (await getServices()).socketManager;
// //   if (hasHttpServer(res)) {
// //     await socketManager.ensureServer(res.socket.server);
// //   }

// //   // const user = await getAuthFromApiCookies(req.cookies);
// //   // if (!user) {
// //   //   res.status(401).json({ message: 'Must authenticate' });
// //   //   return;
// //   // }

// //   const newKey = await (await getServices()).socketManager.getSocketKey(undefined, req.session.socketKey);
// //   if (newKey !== req.session.socketKey) {
// //     req.session.socketKey = newKey;
// //     await req.session.save();
// //   }

// //   res.json({
// //     key: req.session.socketKey,
// //   });
// // }

// // //export default withIronSessionApiRoute(SocketHandler, sessionOptions);
// // export default SocketHandler;
import type { NextApiRequest, NextApiResponse } from 'next';

async function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
  console.log('running sockethandler');
  res.json({
    key: 'ok',
  });
}

export default SocketHandler;
