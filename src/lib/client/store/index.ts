import { configureStore, combineReducers } from '@reduxjs/toolkit';
import type { ThunkAction, Action, Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './auth';
import configReducer from './config';

export const syncMiddleware: Middleware<{}, RootState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
  const result = next(action);
  if (action?.meta?.sync) {
    //sync.handleLocalAction(action, storeApi.getState());
    console.log('ACTION FOR SYNC:', action);
  }
  return result;
}

const rootReducer = combineReducers({
  // activities: activitiesReducer,
  auth: authReducer,
  config: configReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefault => getDefault().concat(syncMiddleware)
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
