import { State } from '@projectstorm/react-canvas-core';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from '../Store/store';

type Modals = 'ViewContract' | 'LoadHex' | 'SaveHex' | 'SapioServer';
type StateType = {
    open_modal: Modals | null;
};
function default_state(): StateType {
    return {
        open_modal: null,
    };
}

export const modalSlice = createSlice({
    name: 'App',
    initialState: default_state(),
    reducers: {
        close_modal: (state) => {
            state.open_modal = null;
        },
        open_modal: (state, action: PayloadAction<Modals>) => {
            state.open_modal = action.payload;
        },
    },
});

export const { close_modal, open_modal } = modalSlice.actions;

export const selectModal: (state: RootState) => Modals | null = (
    state: RootState
) => state.modalReducer.open_modal;
export default modalSlice.reducer;
