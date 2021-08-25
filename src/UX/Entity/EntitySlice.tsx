import { createSlice } from '@reduxjs/toolkit';
import { BitcoinNodeManager, QueriedUTXO } from '../../Data/BitcoinNode';
import * as Bitcoin from 'bitcoinjs-lib';
import { update_utxomodel } from './Detail/UTXODetail';
import { UTXOModel } from '../../Data/UTXO';
import { ContractModel, Data } from '../../Data/ContractManager';
import { AppDispatch, RootState } from '../../Store/store';

type StateType = {
    utxos: Record<string, QueriedUTXO>;
    flash: String | null;
};
function default_state(): StateType {
    return {
        utxos: {},
        flash: null,
    };
}

export const entitySlice = createSlice({
    name: 'Entity',
    initialState: default_state(),
    reducers: {
        clear_utxos: (state, action: { type: string }) => {
            state.utxos = {};
        },
        __flash: (state, action: { type: string; payload: String | null }) => {
            if (action.payload) state.flash = action.payload;
        },
        __load_utxo: (
            state,
            action: {
                type: string;
                payload: [Outpoint, QueriedUTXO];
            }
        ) => {
            const id = to_id(action.payload[0]);
            if (state.utxos.hasOwnProperty(id)) return;
            if (action.payload[1]) state.utxos[id] = action.payload[1];
        },
    },
});

export type Outpoint = { hash: string; nIn: number };
interface OutpointStringDifferentiator extends String { }
export type OutpointString = OutpointStringDifferentiator & string;

export const ValidateOutpointString = (out: string): out is OutpointString => {
    return out.match(/^[A-Fa-f0-9]{64}:[0-9]+$/) !== null;
};

function to_id(args: Outpoint): OutpointString {
    const s = args.hash + ':' + args.nIn.toString();
    if (ValidateOutpointString(s)) return s;
    throw 'ERR: ID not valid';
}
/// private API
const { __load_utxo, __flash } = entitySlice.actions;
export const { clear_utxos } = entitySlice.actions;
export const fetch_utxo = (args: Outpoint) => async (
    dispatch: AppDispatch,
    getState: () => RootState
) => {
    if (getState().entityReducer.utxos.hasOwnProperty(to_id(args))) {
    } else {
        const utxo = await BitcoinNodeManager.fetch_utxo(args.hash, args.nIn);
        if (utxo) {
            dispatch(__load_utxo([args, utxo]));
        }
    }
};

export const create = (
    tx: Bitcoin.Transaction,
    entity: UTXOModel,
    contract: ContractModel,
    load_new_contract: (x: Data) => void
) => async (dispatch: AppDispatch, getState: () => RootState) => {
    await BitcoinNodeManager.fund_out(tx)
        .then((funded) => {
            tx = funded;
            update_utxomodel(entity);
            const data = {
                program: contract.txn_models.map((t) => t.get_json()),
            };
            load_new_contract(data);
        })
        .catch((error) => {
            dispatch(__flash(error.message));
            setTimeout(() => {
                dispatch(__flash(null));
            }, 3000);
        });
};

export const selectUTXO = (
    state: RootState
): ((id: Outpoint) => QueriedUTXO | null) => {
    return (id: Outpoint) => {
        console.debug(id);
        const id_s = to_id(id);
        console.debug(state);
        if (state.entityReducer.utxos.hasOwnProperty(id_s)) {
            return state.entityReducer.utxos[id_s]
        }
        return null;
    };
}
export const selectUTXOFlash = (state: RootState): String | null => state.entityReducer.flash;

export default entitySlice.reducer;
