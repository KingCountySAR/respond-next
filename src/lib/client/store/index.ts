import type { Action, Middleware, PayloadAction, ThunkAction } from '@reduxjs/toolkit';
import { addListener, combineReducers, configureStore, createListenerMiddleware, TypedAddListener, TypedStartListening } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import activitiesReducer from './activities';
import authReducer from './auth';
import configReducer from './config';
import organizationReducer from './organization';
import syncReducer from './sync';

export const logMiddleware: Middleware<unknown, RootState> = (_storeApi) => (next) => (action: PayloadAction) => {
  if (typeof window !== 'undefined') console.log('action ' + action.type, action.payload);
  const result = next(action);
  return result;
};

function buildClientReducers() {
  const rootReducer = combineReducers({
    activities: activitiesReducer,
    auth: authReducer,
    config: configReducer,
    organization: organizationReducer,
    sync: syncReducer,
  });
  return rootReducer;
}

function storeBuilder(middlewares: Middleware[]) {
  const listenerMiddleware = createListenerMiddleware();

  const store = configureStore({
    reducer: buildClientReducers(),
    middleware: (getDefault) =>
      getDefault()
        .prepend(listenerMiddleware.middleware)
        .concat(logMiddleware, ...middlewares),
  });

  return store;
}

export function buildClientStore(middlewares: Middleware[]) {
  clientStoreInstance = clientStoreInstance ?? storeBuilder(middlewares);
  return clientStoreInstance;
}

export type AppStore = ReturnType<typeof storeBuilder>;
export type AppDispatch = AppStore['dispatch'];
type ClientReducerType = ReturnType<typeof buildClientReducers>;
export type RootState = ReturnType<ClientReducerType>;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>;

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export const addAppListener = addListener as TypedAddListener<RootState, AppDispatch>;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

let clientStoreInstance: AppStore;
