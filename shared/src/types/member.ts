// Member data types shared by the client UI and the server member providers.
export interface MemberInfo {
  id: string;
  label?: string;
  name: string;
  given_name: string;
  family_name: string;
  groups: string[];
  email?: string;
  mobilephone?: string;
}

export interface MemberAuthInfo {
  provider: string;
  email: string;
}
