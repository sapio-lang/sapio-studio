import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../Store/store';

export type TabIndexes = 0 | 1 | 2 | 3 | 4;
type StateType = {
    showing: TabIndexes;
};
function default_state(): StateType {
    return {
        showing: 0,
    };
}

export const walletSlice = createSlice({
    name: 'Wallet',
    initialState: default_state(),
    reducers: {
        switch_wallet_tab: (state, action: PayloadAction<TabIndexes>) => {
            state.showing = action.payload;
        },
    },
});

export const { switch_wallet_tab } = walletSlice.actions;

export const selectWalletTab = (r: RootState) => {
    return r.walletReducer.showing;
};

export const walletReducer = walletSlice.reducer;
