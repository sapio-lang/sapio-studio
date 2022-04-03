import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../Store/store';

export type TabIndexes = 0 | 1 | 2 | 3 | 4;
type StateType = {
    showing: TabIndexes;
    workspace: string;
};
function default_state(): StateType {
    return {
        showing: 0,
        workspace: 'default',
    };
}

export const walletSlice = createSlice({
    name: 'Wallet',
    initialState: default_state(),
    reducers: {
        switch_wallet_tab: (state, action: PayloadAction<TabIndexes>) => {
            state.showing = action.payload;
        },
        switch_workspace: (state, action: PayloadAction<string>) => {
            state.workspace = action.payload;
        },
    },
});

export const { switch_wallet_tab, switch_workspace } = walletSlice.actions;

export const selectWalletTab = (r: RootState) => {
    return r.walletReducer.showing;
};

export const selectWorkspace = (r: RootState) => {
    return r.walletReducer.workspace;
};
export const walletReducer = walletSlice.reducer;
