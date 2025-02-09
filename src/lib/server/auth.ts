import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import { UserInfo } from '@respond/types/userInfo';

declare module 'next-auth' {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: UserInfo;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      async profile(profile) {
        return { ...profile, userId: 'abc', organizationId: 'abd' };
      },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      console.log('signin callback', profile);
      return true;
    },
  },
});

// import { unsealData } from 'iron-session';
// import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
// import { ReadonlyRequestCookies } from 'next/dist/server/app-render';
// import { cookies } from 'next/headers';

// import UserAuth from '@respond/types/userAuth';
// import { UserInfo } from '@respond/types/userInfo';

// export async function getCookieAuth() {
//   return getAuthFromCookies(cookies());
// }

// export async function getAuthFromApiCookies(cookies: Partial<{ [key: string]: string }>): Promise<UserAuth | undefined> {
//   const cookieName = process.env.SESSION_COOKIE_NAME as string;
//   return getAuthFromCookie(cookies[cookieName]);
// }

// /**
//  * Can be called in page/layout server component.
//  * @param cookies ReadonlyRequestCookies
//  * @returns UserAuth or undefined
//  */
// export async function getAuthFromCookies(cookies: ReadonlyRequestCookies | RequestCookies): Promise<UserAuth | undefined> {
//   const cookieName = process.env.SESSION_COOKIE_NAME as string;
//   return getAuthFromCookie((await cookies).get(cookieName)?.value);
// }

// async function getAuthFromCookie(sessionCookie?: string) {
//   if (!sessionCookie) return undefined;

//   const { auth } = await unsealData(sessionCookie, {
//     password: process.env.SECRET_COOKIE_PASSWORD as string,
//   });
//   return auth as unknown as UserAuth;
// }

// export function userFromAuth(ticket?: UserAuth): UserInfo | undefined {
//   if (!ticket) return undefined;
//   return {
//     userId: ticket.userId,
//     organizationId: ticket.organizationId,
//     participantId: ticket.userId.split(':')[1],
//     name: ticket.name ?? '',
//     email: ticket.email,
//     domain: ticket.hd ?? '',
//     picture: ticket.picture,
//     given_name: ticket.given_name,
//     family_name: ticket.family_name,
//   };
// }
