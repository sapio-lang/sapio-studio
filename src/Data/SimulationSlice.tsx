import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../Store/store';
import { TXID } from '../util';
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

export const selectIsReachable: (state: RootState) => (t: TXID) => boolean = (
    state: RootState
) => (t: TXID) => !state.simulationReducer.unreachable_models.hasOwnProperty(t);

export const simulationReducer = simulationSlice.reducer;
