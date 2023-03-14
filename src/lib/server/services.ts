import { OAuth2Client } from 'google-auth-library';
import { MemberProviderRegistry } from './memberProviders/memberProvider';
import D4HMembersProvider from './memberProviders/d4hMembersProvider';

export interface Services {
  authClient: OAuth2Client;
  memberProviders: MemberProviderRegistry;
}

let instance: Services;

export function getServices(): Services {
  if (!instance) {
    
    instance = {
      authClient: new OAuth2Client(process.env.GOOGLE_ID),
      memberProviders: new MemberProviderRegistry(),
    };

    //defaultMembersRepositoryRegistry.register('LocalDatabaseMembers', new LocalDatabaseMembersProvider(repo, this.log));
    instance.memberProviders.register('D4HMembers', new D4HMembersProvider());
  }
  return instance;
}