import { configureStore, combineReducers } from '@reduxjs/toolkit';
import type { ThunkAction, Action, Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import activitiesReducer from './activities';
import authReducer from './auth';
import configReducer from './config';
import organizationReducer from './organization';

export const syncMiddleware: Middleware<{}, RootState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
  const result = next(action);
  if (action?.meta?.sync) {
    //sync.handleLocalAction(action, storeApi.getState());
    console.log('ACTION FOR SYNC:', action);
    if (typeof localStorage !== 'undefined') {
      localStorage.activities = JSON.stringify(storeApi.getState().activities);
    }
  }
  return result;
}

export const logMiddleware: Middleware<{}, RootState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
  if (typeof window !== 'undefined') console.log('action ' + action.type, action.payload);
  const result = next(action);
  return result;
}

const rootReducer = combineReducers({
  activities: activitiesReducer,
  auth: authReducer,
  config: configReducer,
  organization: organizationReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefault => getDefault().concat(logMiddleware, syncMiddleware)
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof rootReducer>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;


// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
