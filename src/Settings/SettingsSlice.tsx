import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _ from 'lodash';
import { RootState } from '../Store/store';
import { Dispatch } from '@reduxjs/toolkit';
type Networks = 'Bitcoin' | 'Regtest' | 'Testnet' | 'Signet';
type Settings = {
    display: DisplaySettings;
    bitcoin: { network: Networks };
};

type DisplaySettings = {
    animation_speed: 'Disabled' | { Enabled: number };
    node_polling_freq: number;
    satoshis:
        | { BitcoinAfter: number }
        | { AlwaysSats: null }
        | { AlwaysBitcoin: null };
};
export type SettingsStateType = {
    settings: Settings;
};

function default_state(): SettingsStateType {
    return {
        settings: {
            display: {
                animation_speed: 'Disabled',
                node_polling_freq: 0,
                satoshis: { AlwaysBitcoin: null },
            },
            bitcoin: {
                network: 'Bitcoin',
            },
        },
    };
}

export async function poll_settings(dispatch: Dispatch) {
    dispatch(
        load_settings({
            settings: {
                display: (await window.electron.load_settings_sync(
                    'display'
                )) as unknown as any,
                bitcoin: (await window.electron.load_settings_sync(
                    'bitcoin'
                )) as unknown as any,
            },
        })
    );
}
export const settingsSlice = createSlice({
    name: 'Settings',
    initialState: default_state(),
    reducers: {
        load_settings: (state, action: PayloadAction<SettingsStateType>) => {
            state = _.merge(state, action.payload);
        },
    },
});

export const { load_settings } = settingsSlice.actions;

export const selectMaxSats: (state: RootState) => number = (
    state: RootState
) => {
    if (!state.settingsReducer.settings.display.satoshis) return 0;
    if ('BitcoinAfter' in state.settingsReducer.settings.display.satoshis)
        return state.settingsReducer.settings.display.satoshis.BitcoinAfter;
    else if ('AlwaysSats' in state.settingsReducer.settings.display.satoshis)
        return 100000000 * 21000000;
    return 0;
};

export const selectNodePollFreq: (state: RootState) => number = (
    state: RootState
) => {
    return state.settingsReducer.settings.display.node_polling_freq;
};

export const selectNetwork: (state: RootState) => Networks = (
    state: RootState
) => state.settingsReducer.settings.bitcoin.network;

export const selectAnimateFlow: (state: RootState) => number = (
    state: RootState
) => {
    if (state.settingsReducer.settings.display.animation_speed === 'Disabled')
        return 0;
    return state.settingsReducer.settings.display.animation_speed.Enabled;
};

export const settingsReducer = settingsSlice.reducer;
