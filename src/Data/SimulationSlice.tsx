import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../Store/store';
import { hasOwn, TXID } from '../util';
type SimulationState = {
    unreachable_models: Record<TXID, null>;
    show: boolean;
};
function default_state(): SimulationState {
    return {
        unreachable_models: {},
        show: false,
    };
}

export const simulationSlice = createSlice({
    name: 'Simulation',
    initialState: default_state(),
    reducers: {
        set_unreachable: (state, action: PayloadAction<Record<TXID, null>>) => {
            state.unreachable_models = action.payload;
        },
        toggle_showing: (state) => {
            state.show = !state.show;
        },
    },
});

export const { set_unreachable, toggle_showing } = simulationSlice.actions;

export const selectIsReachable: (state: RootState) => (t: TXID) => boolean =
    (state: RootState) => (t: TXID) =>
        !hasOwn(state.simulationReducer.unreachable_models, t);
export const selectSimIsShowing: (state: RootState) => boolean = (
    state: RootState
) => state.simulationReducer.show;

export const simulationReducer = simulationSlice.reducer;
