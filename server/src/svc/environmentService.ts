import type { ClientEnvironment } from "@app/shared/api";
import { OrganizationService } from "./organizationService";



export class EnvironmentService {
  constructor(
    private readonly orgService: OrganizationService
  ) {
  }

  async getClientEnvironment(hostname: string): Promise<ClientEnvironment> {
    console.log('get client environment for ', hostname);
    return {
      shortTitle: 'ESAR',
      primaryColor: '#008800',
    };
  }
}