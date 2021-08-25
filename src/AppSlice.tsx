import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BitcoinNodeManager, QueriedUTXO } from './Data/BitcoinNode';
import * as Bitcoin from 'bitcoinjs-lib';
import { update_utxomodel } from './UX/Entity/Detail/UTXODetail';
import { UTXOModel } from './Data/UTXO';
import { ContractModel, Data } from './Data/ContractManager';
import { AppDispatch, RootState } from './Store/store';
import { State } from '@projectstorm/react-canvas-core';
type StateType = {
    data: Data | null;
    counter: number;
};
function default_state(): StateType {
    return {
        data: null,
        counter: -1,
    };
}

export const appSlice = createSlice({
    name: 'App',
    initialState: default_state(),
    reducers: {
        load_new_model: (state, action: PayloadAction<Data>) => {
            state.data = action.payload;
            state.counter += 1;
        },
    },
});

export const { load_new_model } = appSlice.actions;

export const create_contract_of_type = (
    type_arg: string,
    contract: any
) => async (dispatch: AppDispatch, getState: () => RootState) => {
    const compiled_contract = await window.electron.create_contract(
        type_arg,
        contract
    );
    dispatch(load_new_model(JSON.parse(compiled_contract)));
};

export const selectContract: (state: RootState) => [Data | null, number] = (
    state: RootState
) => [state.appReducer.data, state.appReducer.counter];

export default appSlice.reducer;
