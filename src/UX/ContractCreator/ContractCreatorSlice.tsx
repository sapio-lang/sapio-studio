import { createSlice, Dispatch, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../Store/store';
import { JSONSchema7 } from 'json-schema';
import {
    APIPath,
    Continuation,
    ContinuationTable,
} from '../../Data/ContractManager';
export type APIs = Record<
    string,
    { name: string; key: string; api: JSONSchema7; logo: string }
>;
type CreatorStateType = {
    apis: null | APIs;
    selected_api: keyof APIs | null;
    show: boolean;
    continuations: ContinuationTable;
};
function default_state(): CreatorStateType {
    return {
        apis: null,
        show: false,
        selected_api: null,
        continuations: {},
    };
}

export const contractCreatorSlice = createSlice({
    name: 'ContractCreator',
    initialState: default_state(),
    reducers: {
        set_apis: (state, action: PayloadAction<APIs>) => {
            state.apis = action.payload;
        },
        select_api: (state, action: PayloadAction<keyof APIs | null>) => {
            state.selected_api = action.payload;
        },
        show_apis: (state, action: PayloadAction<boolean>) => {
            state.show = action.payload;
        },
        set_continuations: (
            state,
            action: PayloadAction<ContinuationTable>
        ) => {
            state.continuations = action.payload;
        },
    },
});
export const { show_apis, set_apis, select_api, set_continuations } =
    contractCreatorSlice.actions;

export const register = (dispatch: Dispatch) => {
    window.electron.register('create_contracts', (apis: APIs) => {
        dispatch(set_apis(apis));
        dispatch(show_apis(true));
    });
};
export const selectAPIs = (rs: RootState): APIs | null => {
    return rs.contractCreatorReducer.apis;
};
export const selectSelectedAPI = (rs: RootState): keyof APIs | null => {
    return rs.contractCreatorReducer.selected_api;
};
export const showAPIs = (rs: RootState): boolean => {
    return rs.contractCreatorReducer.show;
};

export const selectContinuation = (
    rs: RootState
): ((out: string) => null | Record<APIPath, Continuation>) => {
    return (s: string) => {
        const v = rs.contractCreatorReducer.continuations[s];
        return v ?? null;
    };
};

export const contractCreatorReducer = contractCreatorSlice.reducer;
