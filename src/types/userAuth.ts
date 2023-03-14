/* User information from the member provider that we use to make authN/Z decisions */
export default interface UserAuth {
  email: string,
  name?: string,
  hd?: string,
  picture?: string,
  userId: string,
  organizationId: string,
  groups: string[],
  isSiteAdmin: boolean,
  given_name?: string,
  family_name?: string,
}