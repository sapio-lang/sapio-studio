import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import entityReducer from '../UX/Entity/EntitySlice';
import appReducer from '../AppSlice';
import modalReducer from '../UX/ModalSlice';
import { load_settings, settingsReducer } from '../Settings/SettingsSlice';
import {
    contractCreatorReducer,
    register,
} from '../UX/ContractCreator/ContractCreatorSlice';
import { simulationReducer } from '../Data/SimulationSlice';

export const store = configureStore({
    reducer: {
        entityReducer,
        appReducer,
        contractCreatorReducer,
        simulationReducer,
        settingsReducer,
        modalReducer,
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
