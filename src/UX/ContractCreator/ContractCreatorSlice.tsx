import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createSelectorCreator, defaultMemoize } from 'reselect';

import { RootState } from '../../Store/store';
import {
    API,
    APIPath,
    Continuation,
    ContinuationTable,
} from '../../common/preload_interface';
import _ from 'lodash';
type CreatorStateType = {
    apis: null | API;
    selected_api: keyof API | null;
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
        set_apis: (state, action: PayloadAction<API>) => {
            state.apis = action.payload;
        },
        select_api: (state, action: PayloadAction<keyof API | null>) => {
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

//export const register = (dispatch: Dispatch) => {
//    window.electron.register_callback('create_contracts', (apis: API) => {
//        dispatch(set_apis(apis));
//        dispatch(show_apis(true));
//    });
//};
const selectAPIs = (rs: RootState): API | null => {
    return rs.contractCreatorReducer.apis;
};
const selectSelectedAPI = (rs: RootState): keyof API | null => {
    return rs.contractCreatorReducer.selected_api;
};

const createDeepEqualSelector = createSelectorCreator(
    defaultMemoize,
    _.isEqual
);

export const selectAPI = createDeepEqualSelector(
    [selectAPIs, selectSelectedAPI],
    (apis, key) => (apis === null || key === null ? null : apis[key] ?? null)
);
export const selectAPIEntries = createDeepEqualSelector([selectAPIs], (apis) =>
    Object.entries(apis ?? {})
);

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
