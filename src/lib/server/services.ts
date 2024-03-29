import { OAuth2Client } from 'google-auth-library';

import { MemberProviderType } from '@respond/types/data/MemberProviderType';

import D4HMembersProvider from './memberProviders/d4hMembersProvider';
import { MemberProviderRegistry } from './memberProviders/memberProvider';
import SocketManager from './socketManager';
import { StateManager } from './stateManager';

export interface Services {
  authClient: OAuth2Client;
  memberProviders: MemberProviderRegistry;
  socketManager: SocketManager;
  stateManager: StateManager;
}

let instance: Services;

export async function getServices(): Promise<Services> {
  if (!instance) {
    instance = {
      authClient: new OAuth2Client(process.env.GOOGLE_ID),
      memberProviders: new MemberProviderRegistry(),
      socketManager: new SocketManager(),
      stateManager: new StateManager(),
    };

    //defaultMembersRepositoryRegistry.register('LocalDatabaseMembers', new LocalDatabaseMembersProvider(repo, this.log));
    instance.memberProviders.register(MemberProviderType.D4H, new D4HMembersProvider());

    await instance.stateManager.start();
  }
  return instance;
}
