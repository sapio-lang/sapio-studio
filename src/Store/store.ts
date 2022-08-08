import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import appReducer from '../AppSlice';
import { dataReducer } from '../Data/DataSlice';
import { simulationReducer } from '../Data/SimulationSlice';
import { settingsReducer } from '../Settings/SettingsSlice';
import { contractCreatorReducer } from '../UX/ContractCreator/ContractCreatorSlice';
import entityReducer from '../UX/Entity/EntitySlice';
import modalReducer from '../UX/ModalSlice';
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

export const useAppDispatch: () => AppDispatch = useDispatch;
