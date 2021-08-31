import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BitcoinNodeManager, QueriedUTXO } from './Data/BitcoinNode';
import * as Bitcoin from 'bitcoinjs-lib';
import { update_utxomodel } from './UX/Entity/Detail/UTXODetail';
import { UTXOModel } from './Data/UTXO';
import { ContractModel, Data } from './Data/ContractManager';
import { AppDispatch, RootState } from './Store/store';
import { State } from '@projectstorm/react-canvas-core';
import { TXID } from './util';
type SimulationState = {
    unreachable_models: Record<TXID, null>;
};
function default_state(): SimulationState {
    return {
        unreachable_models: {},
    };
}

export const simulationSlice = createSlice({
    name: 'Simulation',
    initialState: default_state(),
    reducers: {
        set_unreachable: (state, action: PayloadAction<Record<TXID, null>>) => {
            state.unreachable_models = action.payload;
        },
    },
});

export const { set_unreachable } = simulationSlice.actions;

export const selectIsUnreachable: (state: RootState) => (t: TXID) => boolean = (
    state: RootState
) => (t: TXID) => !state.simulationReducer.unreachable_models.hasOwnProperty(t);

export const simulationReducer = simulationSlice.reducer;
