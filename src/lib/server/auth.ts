import UserAuth from '@respond/types/userAuth';
import { UserInfo } from '@respond/types/userInfo';
import { unsealData } from "iron-session";
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from "next/dist/server/app-render";
import { cookies } from 'next/headers';

export async function getCookieAuth() {
  return getAuthFromCookies(cookies());
}

/**
 * Can be called in page/layout server component.
 * @param cookies ReadonlyRequestCookies
 * @returns UserAuth or undefined
 */
export async function getAuthFromCookies(
  cookies: ReadonlyRequestCookies|RequestCookies
): Promise<UserAuth | null> {
  const cookieName = process.env.SESSION_COOKIE_NAME as string;
  const found = cookies.get(cookieName);

  if (!found) return null;

  const { auth } = await unsealData(found.value, {
    password: process.env.SECRET_COOKIE_PASSWORD as string,
  });
  return auth as unknown as UserAuth;
}


export function userFromAuth(ticket?: UserAuth): UserInfo|undefined {
  if (!ticket) return undefined;
  return {
    userId: ticket.userId,
    name: ticket.name ?? '',
    email: ticket.email,
    domain: ticket.hd ?? '',
    picture: ticket.picture,
    given_name: ticket.given_name,
  }
}