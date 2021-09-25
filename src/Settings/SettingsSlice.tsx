import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../Store/store';
type Networks = 'mainnet' | 'regtest' | 'testnet' | 'signet';
type Settings = {
    display: {
        'sats-bound': number;
        'poll-node-freq': number;
        'animate-flow': number;
    };
    'bitcoin-config': {
        network: Networks;
    };
};
type StateType = {
    settings: Settings;
};

function default_state(): StateType {
    return { settings: window.electron.get_preferences_sync() };
}

export const settingsSlice = createSlice({
    name: 'Settings',
    initialState: default_state(),
    reducers: {
        load_settings: (state, action: PayloadAction<Settings>) => {
            state.settings = action.payload;
        },
    },
});

export const { load_settings } = settingsSlice.actions;

export const selectMaxSats: (state: RootState) => number = (state: RootState) =>
    state.settingsReducer.settings.display['sats-bound'];

export const selectNodePollFreq: (state: RootState) => number = (
    state: RootState
) => state.settingsReducer.settings.display['poll-node-freq'];

export const selectNetwork: (state: RootState) => Networks = (
    state: RootState
) => state.settingsReducer.settings['bitcoin-config'].network;

export const selectAnimateFlow: (state: RootState) => number = (
    state: RootState
) => state.settingsReducer.settings.display['animate-flow'] / 1000.0;

export const settingsReducer = settingsSlice.reducer;
