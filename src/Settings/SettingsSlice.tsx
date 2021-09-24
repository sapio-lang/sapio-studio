import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../Store/store';
type Settings = any;
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

export const DEFAULT_MAX_SATS_DISPLAY: number = 9999999;
export const selectMaxSats: (state: RootState) => number = (state: RootState) =>
    state.settingsReducer?.settings?.display['sats-bound'] ??
    DEFAULT_MAX_SATS_DISPLAY;

export const selectNodePollFreq: (state: RootState) => number = (
    state: RootState
) => state.settingsReducer?.settings?.display?.['poll-node-freq'] ?? 5;

type Networks = 'mainnet' | 'regtest' | 'testnet' | 'signet';
export const selectNetwork: (state: RootState) => Networks = (
    state: RootState
) => state.settingsReducer?.settings?.['bitcoin-config']?.network ?? 'regtest';

const DEFAULT_SECONDS_ANIMATION = 0;
export const selectAnimateFlow: (state: RootState) => number = (
    state: RootState
) =>
    (state.settingsReducer?.settings?.display['animate-flow'] ||
        DEFAULT_SECONDS_ANIMATION) / 1000.0;

export const settingsReducer = settingsSlice.reducer;
