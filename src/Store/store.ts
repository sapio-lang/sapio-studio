import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import entityReducer from '../UX/Entity/EntitySlice';
import appReducer from '../AppSlice';
import { dataReducer } from '../Data/DataSlice';
import modalReducer from '../UX/ModalSlice';
import { settingsReducer } from '../Settings/SettingsSlice';
import { contractCreatorReducer } from '../UX/ContractCreator/ContractCreatorSlice';
import { simulationReducer } from '../Data/SimulationSlice';
import { walletReducer } from '../Wallet/Slice/Reducer';

export const store = configureStore({
    reducer: {
        entityReducer,
        appReducer,
        contractCreatorReducer,
        simulationReducer,
        settingsReducer,
        modalReducer,
        dataReducer,
        walletReducer,
    },
    middleware: [thunk],
    devTools: true,
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>;
