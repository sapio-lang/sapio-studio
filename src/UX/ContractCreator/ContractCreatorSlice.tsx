import { createSlice, Dispatch, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../Store/store';
import { JSONSchema7 } from 'json-schema';
export type APIs = Record<
    string,
    { name: string; key: string; api: JSONSchema7; logo: string }
>;
type CreatorStateType = {
    apis: null | APIs;
    show: boolean;
};
function default_state(): CreatorStateType {
    return {
        apis: null,
        show: false,
    };
}

export const contractCreatorSlice = createSlice({
    name: 'ContractCreator',
    initialState: default_state(),
    reducers: {
        set_apis: (state, action: PayloadAction<APIs>) => {
            state.apis = action.payload;
        },
        show_apis: (state, action: PayloadAction<boolean>) => {
            state.show = action.payload;
        },
    },
});
export const { show_apis, set_apis } = contractCreatorSlice.actions;

export const register = (dispatch: Dispatch) => {
    window.electron.register('create_contracts', (apis: APIs) => {
        dispatch(set_apis(apis));
        dispatch(show_apis(true));
    });
};
export const selectAPIs = (rs: RootState): APIs | null => {
    return rs.contractCreatorReducer.apis;
};
export const showAPIs = (rs: RootState): boolean => {
    return rs.contractCreatorReducer.show;
};

export const contractCreatorReducer = contractCreatorSlice.reducer;
