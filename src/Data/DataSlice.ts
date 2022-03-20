import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _ from 'lodash';
import { RootState } from '../Store/store';
import { Dispatch } from '@reduxjs/toolkit';
import { Status } from './BitcoinNode';
import { Transaction } from 'electron';
import { TransactionState } from '../UX/Diagram/DiagramComponents/TransactionNode/TransactionNodeModel';
import { Input } from 'bitcoinjs-lib/types/transaction';
import { hash_to_hex, TXIDAndWTXIDMap } from '../util';
import { ContractModel } from './ContractManager';
type TXID = string;
export type DataStateType = {
    status: Record<TXID, Status>;
    state: Record<TXID, TransactionState>;
};

function default_state(): DataStateType {
    return {
        status: {},
        state: {},
    };
}

export const settingsSlice = createSlice({
    name: 'Settings',
    initialState: default_state(),
    reducers: {
        load_status: (
            state,
            action: PayloadAction<{
                status: Record<TXID, Status>;
                state: Record<TXID, TransactionState>;
            }>
        ) => {
            if (
                _.isEqual(state.status, action.payload.status) &&
                _.isEqual(state.state, action.payload.state)
            )
                return;
            state.status = action.payload.status;
            state.state = action.payload.state;
        },
    },
});

export const { load_status } = settingsSlice.actions;

const memo_number = -1;
const g_memo: Record<number, Record<TXID, TransactionState>> = {};

export const selectStatus: (
    txid: TXID
) => (state: RootState) => TransactionState = (txid) => (state: RootState) => {
    // return type must be based on state
    return state.dataReducer.state[txid]!;
};
export const dataReducer = settingsSlice.reducer;
