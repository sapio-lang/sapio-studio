import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from './Store/store';
import { createSelectorCreator, defaultMemoize } from 'reselect';
import _ from 'lodash';
import { CreatedContract, Data } from './common/preload_interface';

type Pages =
    | 'ContractCreator'
    | 'ContractViewer'
    | 'Wallet'
    | 'Settings'
    | 'MiniscriptCompiler';
type StateType = {
    data: CreatedContract | null;
    counter: number;
    status_bar: boolean;
    showing: Pages;
};
function default_state(): StateType {
    return {
        data: null,
        counter: -1,
        status_bar: true,
        showing: 'Wallet',
    };
}

export const appSlice = createSlice({
    name: 'App',
    initialState: default_state(),
    reducers: {
        switch_showing: (state, action: PayloadAction<Pages>) => {
            state.showing = action.payload;
        },
        load_new_model: (state, action: PayloadAction<CreatedContract>) => {
            state.data = action.payload;
            state.counter += 1;
        },
        toggle_status_bar: (state) => {
            state.status_bar = !state.status_bar;
        },
        add_effect_to_contract: (
            state,
            action: PayloadAction<
                [string, string, Record<string | number, unknown>]
            >
        ) => {
            if (state.data === null) return;
            if (state.data.args.context.effects === undefined)
                state.data.args.context.effects = {};
            if (state.data.args.context.effects.effects === undefined)
                state.data.args.context.effects.effects = {};
            const data =
                state.data.args.context.effects.effects[action.payload[0]] ??
                {};
            data[action.payload[1]] = action.payload[2];
            state.data.args.context.effects.effects[action.payload[0]] = data;
        },
    },
});

export const {
    switch_showing,
    load_new_model,
    toggle_status_bar,
    add_effect_to_contract,
} = appSlice.actions;

export const create_contract_of_type =
    (type_arg: string, txn: string | null, contract: any) =>
    async (dispatch: AppDispatch, getState: () => RootState) => {
        const compiled_contract = await window.electron.sapio.create_contract(
            type_arg,
            txn,
            contract
        );
        if ('ok' in compiled_contract && compiled_contract.ok)
            dispatch(
                load_new_model({
                    args: JSON.parse(contract),
                    name: type_arg,
                    data: JSON.parse(compiled_contract.ok),
                })
            );
    };
export const recreate_contract =
    () => async (dispatch: AppDispatch, getState: () => RootState) => {
        const s = getState();
        if (s.appReducer.data === null) return;
        return create_contract_of_type(
            s.appReducer.data.name,
            s.appReducer.data.data.program['funding']?.txs[0]?.linked_psbt
                ?.psbt ?? null,
            JSON.stringify(s.appReducer.data.args)
        )(dispatch, getState);
    };

export const open_contract_directory =
    (file_name: string) =>
    async (dispatch: AppDispatch, getState: () => RootState) => {
        window.electron.sapio.compiled_contracts.open(file_name).then((v) => {
            if ('err' in v) return;
            return 'ok' in v && dispatch(load_new_model(v.ok));
        });
    };

export const create_contract_from_file =
    () => async (dispatch: AppDispatch, getState: () => RootState) => {
        window.electron.sapio
            .open_contract_from_file()
            .then(
                (v) => 'ok' in v && dispatch(load_new_model(JSON.parse(v.ok)))
            );
    };

export const selectContract: (state: RootState) => [Data | null, number] = (
    state: RootState
) => [state.appReducer.data?.data ?? null, state.appReducer.counter];

export const selectCreatedContract: (
    state: RootState
) => CreatedContract | null = (state: RootState) => {
    return state.appReducer.data;
};

export const selectStatusBar: (state: RootState) => boolean = (
    state: RootState
) => state.appReducer.status_bar;

const createDeepEqualSelector = createSelectorCreator(
    defaultMemoize,
    _.isEqual
);
export const selectHasEffect = createDeepEqualSelector(
    [
        (state: RootState, path: string) =>
            state.appReducer.data?.args.context.effects?.effects ?? {},
    ],
    (d) => Object.fromEntries(Object.keys(d).map((k) => [k, null]))
);

export const selectShowing: (state: RootState) => Pages = (state: RootState) =>
    state.appReducer.showing;
export default appSlice.reducer;
