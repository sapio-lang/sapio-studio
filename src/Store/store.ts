import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import entityReducer from '../UX/Entity/EntitySlice';

export const store = configureStore({
    reducer: { entityReducer },
    middleware: [thunk],
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>;
