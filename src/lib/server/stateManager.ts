import { combineReducers, configureStore, createSlice, Middleware, PayloadAction } from '@reduxjs/toolkit';
import mongoPromise from '@respond/lib/server/mongodb';
import { ActivityAction, ActivityActions, ActivityState, BasicReducers } from '@respond/lib/state';
import { Activity } from '@respond/types/activity';
import produce from 'immer';
import { monthsToQuarters } from 'date-fns';
import UserAuth from '@respond/types/userAuth';

export interface StateManagerClient {
  get id(): string;
  broadcastAction(action: ActivityAction, reporterId: string): void;
}

export class StateManager {
  private readonly clients: Record<string, StateManagerClient> = {};
  private activityState: ActivityState = { list: [] };

  // private readonly store: ServerStore;
  // storeActions: { load: (value: ActivityState) => PayloadAction<ActivityState> };

  constructor() {
    //const { store, actions } = buildServerStore();
    // this.store = store;
    // this.storeActions = actions;
  }

  addClient(client: StateManagerClient) {
    this.clients[client.id] = client;
    console.log(`${Object.keys(this.clients).length} clients connected to state manager`, Object.keys(this.clients));
  }

  removeClient(clientId: string) {
    delete this.clients[clientId];
    console.log(`${Object.keys(this.clients).length} clients connected to state manager`, Object.keys(this.clients));
  }

  async start() {
    const mongo = await mongoPromise;
    this.activityState = {
      list: await mongo.db().collection<Activity>('activities').find().toArray()
    };
   // this.store.dispatch(this.storeActions.load({ list: dbActivities }));
  }

  getStateForUser(user: UserAuth) {
    console.log('getting state for ' + user.userId);
    return this.activityState;
  }

  async handleIncomingAction(action: ActivityAction, reporterId: string, auth: UserAuth) {
    console.log('stateManager reportAction', action);
    
    // If everything checks out, play the action into our store.

    const oldActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});

    const nextState = produce(this.activityState, draft => {
      console.log('reducing ', action.type, action.payload);
      const f = BasicReducers[action.type](draft, action as any);
    })

    // TODO: Validate nextState
    this.activityState = nextState;

    //console.log(nextState);
    const mongo = await mongoPromise;

    await mongo.db().collection('history').insertOne({
      action: action,
      time: new Date(),
      userId: auth.userId,
      email: auth.email,
    });

    const currentActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
    for (const updatedId of Object.keys(currentActivities).filter(k => oldActivities[k] !== currentActivities[k])) {
      console.log('MONGO update activity', updatedId);
      await mongo.db().collection<Activity>('activities').replaceOne({ id: updatedId }, currentActivities[updatedId], { upsert: true });  
    }
    for (const removedId of Object.keys(oldActivities).filter(k => currentActivities[k] == undefined)) {
      console.log('MONGO remove activity', removedId);
      // delete (oldActivities[removedId] as any)._id;
      // await mongo.db().collection<Activity>('activities-del').insertOne( oldActivities[removedId]);
      await mongo.db().collection<Activity>('activities').deleteOne({id: removedId });
    }

   // this.store.dispatch(action);

    //const currentActivities: Record<string, Activity> = this.store.getState().activities.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
    
    // const mongo = await mongoPromise;

    // for (const updatedId of Object.keys(currentActivities).filter(k => oldActivities[k] !== currentActivities[k])) {
    //   console.log('MONGO update activity', updatedId);
    //   await mongo.db().collection<Activity>('activities').replaceOne({ id: updatedId }, currentActivities[updatedId], { upsert: true });  
    // }
    // for (const removedId of Object.keys(oldActivities).filter(k => currentActivities[k] == undefined)) {
    //   console.log('MONGO remove activity', removedId);
    //   await mongo.db().collection<Activity>('activities-del').insertOne( oldActivities[removedId]);
    //   await mongo.db().collection<Activity>('activities').deleteOne({id: removedId });
    // }

    action.meta.sync = false;
    Object.values(this.clients).forEach(c => c.broadcastAction(action, reporterId));
  }
}

// function buildServerStore() {
//   let initialState: ActivityState = {
//     list: [],
//   };

//   if (typeof localStorage !== 'undefined' && localStorage.activities) {
//     initialState = JSON.parse(localStorage.activities);
//   }

//   const activitiesSlice = createSlice({
//     name: 'activities',
//     initialState,
//     reducers: {
//       load: (state, action: PayloadAction<ActivityState>) => {
//         Object.assign(state, action.payload);
//       }
//     },
//     extraReducers: (builder) => {
//       builder
//         .addCase(ActivityActions.update, BasicReducers.update)
//         .addCase(ActivityActions.remove, BasicReducers.remove)
//         .addCase(ActivityActions.appendOrganizationTimeline, BasicReducers.appendOrganizationTimeline)
//     },
//   });

//   const rootReducer = combineReducers({
//     activities: activitiesSlice.reducer,
//   });

//   type ServerStoreState = ReturnType<typeof rootReducer>;
//   const logMiddleware: Middleware<{}, ServerStoreState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
//     console.log('server store ' + action.type, action.payload);
//     const result = next(action);
//     return result;
//   }

//   const store = configureStore({
//     reducer: rootReducer,
//     middleware: getDefault => getDefault().concat(logMiddleware)
//   });
//   return { store, actions: activitiesSlice.actions };
// }

// type ServerStore = ReturnType<typeof buildServerStore>['store'];
