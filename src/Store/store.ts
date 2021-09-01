import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import entityReducer from '../UX/Entity/EntitySlice';
import appReducer from '../AppSlice';
import {
    contractCreatorReducer,
    register,
} from '../UX/ContractCreator/ContractCreatorSlice';
import { composeWithDevTools } from '@reduxjs/toolkit/dist/devtoolsExtension';
import { simulationReducer } from '../SimulationSlice';

export const store = configureStore({
    reducer: {
        entityReducer,
        appReducer,
        contractCreatorReducer,
        simulationReducer,
    },
    middleware: [thunk],
    devTools: true,
});
register(store.dispatch);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>;
