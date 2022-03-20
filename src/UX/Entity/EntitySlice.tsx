import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as Bitcoin from 'bitcoinjs-lib';
import Color from 'color';
import { BitcoinNodeManager, QueriedUTXO } from '../../Data/BitcoinNode';
import { ContractModel } from '../../Data/ContractManager';
import { update_utxomodel, UTXOModel } from '../../Data/UTXO';
import { AppDispatch, RootState } from '../../Store/store';
import { Outpoint, outpoint_to_id, TXID } from '../../util';
export type EntityType = ['TXN', TXID] | ['UTXO', Outpoint] | ['NULL', null];
type StateType = {
    utxos: Record<string, QueriedUTXO>;
    flash: string | null;
    last_selected: EntityType;
    show_entity_viewer: boolean;
    colors: Record<string, string>;
    purpose: Record<string, string>;
};
function default_state(): StateType {
    return {
        utxos: {},
        flash: null,
        last_selected: ['NULL', null],
        show_entity_viewer: false,
        colors: {},
        purpose: {},
    };
}

export const entitySlice = createSlice({
    name: 'Entity',
    initialState: default_state(),
    reducers: {
        set_custom_color: (state, action: PayloadAction<[string, string]>) => {
            state.colors[action.payload[0]] = action.payload[1];
        },
        set_custom_purpose: (
            state,
            action: PayloadAction<[string, string]>
        ) => {
            state.purpose[action.payload[0]] = action.payload[1];
        },
        clear_utxos: (state, action: { type: string }) => {
            state.utxos = {};
        },
        select_txn: (state, action: PayloadAction<TXID>) => {
            state.last_selected = ['TXN', action.payload];
            state.show_entity_viewer = true;
        },
        select_utxo: (state, action: PayloadAction<Outpoint>) => {
            state.last_selected = ['UTXO', action.payload];
            state.show_entity_viewer = true;
        },
        deselect_entity: (state) => {
            state.show_entity_viewer = false;
        },
        __flash: (state, action: { type: string; payload: string | null }) => {
            if (action.payload) state.flash = action.payload;
        },
        __load_utxo: (
            state,
            action: {
                type: string;
                payload: [Outpoint, QueriedUTXO];
            }
        ) => {
            const id = outpoint_to_id(action.payload[0]);
            if (state.utxos.hasOwnProperty(id)) return;
            if (action.payload[1]) state.utxos[id] = action.payload[1];
        },
    },
});

/// private API
const { __load_utxo, __flash } = entitySlice.actions;
export const {
    deselect_entity,
    select_txn,
    select_utxo,
    clear_utxos,
    set_custom_color,
    set_custom_purpose,
} = entitySlice.actions;
export const fetch_utxo =
    (args: Outpoint) =>
    async (dispatch: AppDispatch, getState: () => RootState) => {
        if (
            getState().entityReducer.utxos.hasOwnProperty(outpoint_to_id(args))
        ) {
        } else {
            const utxo = await BitcoinNodeManager.fetch_utxo(
                args.hash,
                args.nIn
            );
            if (utxo) {
                dispatch(__load_utxo([args, utxo]));
            }
        }
    };

export const create =
    (tx: Bitcoin.Transaction, entity: UTXOModel, contract: ContractModel) =>
    async (dispatch: AppDispatch, getState: () => RootState) => {
        await BitcoinNodeManager.fund_out(tx)
            .then((funded) => {
                tx = funded;
                update_utxomodel(entity);
                // TODO: Fix continue APIs, maybe add a Data merge operation
                //          const data: Data = {
                //              program: [{
                //                    txs: contract.txn_models.map((t) => {
                //                        return { linked_psbt: t.get_json() };
                //                    }), continue_apis: {}
                //                }],
                //          };
                //        dispatch(load_new_model(data));
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
        const id_s = outpoint_to_id(id);
        return state.entityReducer.utxos[id_s] ?? null;
    };
};

export const selectUTXOColor: (
    id: Outpoint
) => (state: RootState) => Color | null = (id) => (state) => {
    const color = state.entityReducer.colors[outpoint_to_id(id)];
    if (!color) return null;
    return Color(color);
};
export const selectTXNColor: (id: TXID) => (state: RootState) => Color | null =
    (id) => (state) => {
        const color = state.entityReducer.colors[id];
        if (!color) return null;
        return Color(color);
    };
export const selectTXNPurpose: (
    id: TXID
) => (state: RootState) => string | null = (id) => (state) =>
    state.entityReducer.purpose[id] ?? null;

export const selectUTXOFlash = (state: RootState): string | null =>
    state.entityReducer.flash;

export const selectEntityToView = (state: RootState): EntityType =>
    state.entityReducer.last_selected;
export const selectShouldViewEntity = (state: RootState): boolean =>
    state.entityReducer.show_entity_viewer;

export default entitySlice.reducer;
