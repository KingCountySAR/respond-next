export interface StateManagerClient {
  get id(): string;
  broadcastAction(action: any, reporterId: string): void;
}

export class StateManager {
  clients: Record<string, StateManagerClient> = {};

  addClient(client: StateManagerClient) {
    this.clients[client.id] = client;
    console.log(`${Object.keys(this.clients).length} clients connected to state manager`, Object.keys(this.clients));
  }

  removeClient(clientId: string) {
    delete this.clients[clientId];
    console.log(`${Object.keys(this.clients).length} clients connected to state manager`, Object.keys(this.clients));
  }

  handleIncomingAction(action: any, reporterId: string) {
    console.log('stateManager reportAction', action);
    Object.values(this.clients).forEach(c => c.broadcastAction(action, reporterId));
  }
}