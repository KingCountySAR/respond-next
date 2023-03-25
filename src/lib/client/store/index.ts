import { configureStore, combineReducers, createListenerMiddleware, TypedStartListening, addListener, TypedAddListener } from '@reduxjs/toolkit';
import type { ThunkAction, Action, Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import activitiesReducer from './activities';
import authReducer from './auth';
import configReducer from './config';
import organizationReducer from './organization';
import syncReducer from './sync';

export const logMiddleware: Middleware<{}, RootState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
  if (typeof window !== 'undefined') console.log('action ' + action.type, action.payload);
  const result = next(action);
  return result;
}

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



export function buildClientStore(middlewares: Middleware[]) {
  const listenerMiddleware = createListenerMiddleware();

  return configureStore({
    reducer: buildClientReducers(),
    middleware: getDefault => getDefault()
      .prepend(listenerMiddleware.middleware)
      .concat(logMiddleware, ...middlewares)
  });
}

export type AppStore = ReturnType<typeof buildClientStore>;
export type AppDispatch = AppStore['dispatch'];
type ClientReducerType = ReturnType<typeof buildClientReducers>;
export type RootState = ReturnType<ClientReducerType>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export const addAppListener = addListener as TypedAddListener<RootState, AppDispatch>;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
