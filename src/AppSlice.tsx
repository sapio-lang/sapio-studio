import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Data } from './Data/ContractManager';
import { AppDispatch, RootState } from './Store/store';
type StateType = {
    data: Data | null;
    counter: number;
    status_bar: boolean;
};
function default_state(): StateType {
    return {
        data: null,
        counter: -1,
        status_bar: true,
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
        toggle_status_bar: (state) => {
            state.status_bar = !state.status_bar;
        },
    },
});

export const { load_new_model, toggle_status_bar } = appSlice.actions;

export const create_contract_of_type = (
    type_arg: string,
    contract: any
) => async (dispatch: AppDispatch, getState: () => RootState) => {
    const compiled_contract = await window.electron.create_contract(
        type_arg,
        contract
    );
    if (compiled_contract)
        dispatch(load_new_model(JSON.parse(compiled_contract)));
};
export const recreate_contract = () => async (
    dispatch: AppDispatch,
    getState: () => RootState
) => {
    const compiled_contract = await window.electron.recreate_contract();
    if (compiled_contract)
        dispatch(load_new_model(JSON.parse(compiled_contract)));
};
export const create_contract_from_file = () => async (
    dispatch: AppDispatch,
    getState: () => RootState
) => {
    const compiled_contract = await window.electron.open_contract_from_file();
    dispatch(load_new_model(JSON.parse(compiled_contract)));
};

export const selectContract: (state: RootState) => [Data | null, number] = (
    state: RootState
) => [state.appReducer.data, state.appReducer.counter];
export const selectStatusBar: (state: RootState) => boolean = (
    state: RootState
) => state.appReducer.status_bar;

export default appSlice.reducer;
