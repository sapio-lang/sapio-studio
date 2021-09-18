import React, { FormEvent } from 'react';
import { ContractModel } from '../Data/ContractManager';

import _ from 'lodash';
import './Simulation.css';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { useDispatch } from 'react-redux';
import { set_unreachable } from './SimulationSlice';
import { TXID } from '../util';
import {
    IconButton,
    Slider,
    TextField,
    Typography,
    Tooltip,
} from '@mui/material';
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined';
import { green, red, pink } from '@mui/material/colors';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { ChangeEvent } from 'react-transition-group/node_modules/@types/react';
export function SimulationController(props: {
    contract: ContractModel;
    engine: DiagramEngine;
    hide: () => void;
}) {
    const dispatch = useDispatch();
    const prefs = window.electron.get_preferences_sync();
    // Start at 0 to make scaling work riht away
    const [min_time_ms, setMinTimeMs] = React.useState(Date.now());
    const [max_time_ms, setMaxTimeMs] = React.useState(
        Date.now() + 365 * 24 * 60 * 60 * 1000
    );
    const pct_to_value = (p: number, max: number, min: number) =>
        Math.round((max - min) * (p / 100.0) + min);
    const [first_tx_time_ms, setFirstTxTime] = React.useState(
        pct_to_value(33, max_time_ms, min_time_ms)
    );
    const [current_time_ms, setCurrentTxTime] = React.useState(
        pct_to_value(50, max_time_ms, min_time_ms)
    );
    const is_regtest = prefs['bitcoin-config'].network === 'regtest';
    const current_year = Math.round(
        (new Date().getFullYear() - 2008) * 144 * 365 - (144 * 365) / 2
    );
    const [min_blocks, setMinBlocks] = React.useState(
        is_regtest ? 100 : current_year
    );
    const [max_blocks, setMaxBlocks] = React.useState(
        is_regtest ? 1000 : current_year + 365 * 144
    );
    const [first_tx_block, setFirstTxBlockPct] = React.useState(
        pct_to_value(33, max_blocks, min_blocks)
    );
    const [current_block, setCurrentBlockPct] = React.useState(
        pct_to_value(66, max_blocks, min_blocks)
    );
    const clear = () => {
        dispatch(set_unreachable({}));
    };
    const wrapper = (f: (input: HTMLInputElement) => void) => (
        e: FormEvent
    ) => {
        const input = e.currentTarget as HTMLInputElement;
        f(input);
    };

    const updateMinTime = (e: ChangeEvent<HTMLInputElement>) => {
        setMinTimeMs(Date.parse(e.currentTarget.value) ?? max_time_ms);
    };
    const updateBlocks = (
        e: Event,
        n: number | number[],
        activeThumb: number
    ) => {
        if (typeof n !== 'number') {
            if (n.length === 2) {
                setFirstTxBlockPct(n[0]!);
                setCurrentBlockPct(n[1]!);
            }
        }
    };
    const updateTimes = (
        e: Event,
        n: number | number[],
        activeThumb: number
    ) => {
        if (typeof n !== 'number') {
            if (n.length === 2) {
                setFirstTxTime(n[0]!);
                setCurrentTxTime(n[1]!);
            }
        }
    };
    const updateMaxTime = (e: ChangeEvent<HTMLInputElement>) => {
        setMaxTimeMs(Date.parse(e.currentTarget.value) ?? max_time_ms);
    };
    const updateMinBlocks = wrapper((input: HTMLInputElement) => {
        setMinBlocks(input.valueAsNumber);
    });
    const updateMaxBlocks = wrapper((input: HTMLInputElement) => {
        setMaxBlocks(input.valueAsNumber);
    });
    React.useEffect(() => {
        const unreachable = props.contract.reachable_at_time(
            current_time_ms / 1000,
            current_block,
            first_tx_time_ms / 1000,
            first_tx_block
        );
        let r: Record<TXID, null> = {};
        for (const model of unreachable) {
            r[model.get_txid()] = null;
        }
        dispatch(set_unreachable(r));
    }, [
        first_tx_block,
        first_tx_time_ms,
        max_blocks,
        min_blocks,
        max_time_ms,
        min_time_ms,
        current_time_ms,
        current_block,
    ]);

    const snapBlocks = () => {
        const new_first_tx_block = first_tx_block;
        const new_current_block = current_block;
        if (new_first_tx_block === new_current_block) return;

        let new_start = Math.min(new_first_tx_block, new_current_block);
        // at least one day...
        let new_end = Math.max(
            new_first_tx_block,
            new_current_block,
            new_start + 144
        );
        let delta = Math.abs(new_current_block - new_first_tx_block);
        new_start = Math.max(new_start - delta, 0);
        new_end += delta;

        setMinBlocks(Math.round(new_start));
        setMaxBlocks(Math.round(new_end));
        setFirstTxBlockPct(
            pct_to_value(
                new_current_block > new_first_tx_block ? 33 : 66,
                Math.round(new_end),
                Math.round(new_start)
            )
        );
        setCurrentBlockPct(
            pct_to_value(
                new_current_block > new_first_tx_block ? 66 : 33,
                Math.round(new_end),
                Math.round(new_start)
            )
        );
    };
    const snapTime = () => {
        // work in seconds
        const new_first_tx_time = first_tx_time_ms / 1000;
        const new_current_time = current_time_ms / 1000;
        if (new_first_tx_time === new_current_time) return;

        let new_start = Math.min(new_first_tx_time, new_current_time);
        // at least one day...
        let new_end = Math.max(
            new_first_tx_time,
            new_current_time,
            new_start + 24 * 60 * 60
        );
        let delta = Math.abs(new_current_time - new_first_tx_time);
        new_start -= delta;
        new_end += delta;

        setMinTimeMs(new_start * 1000);
        setMaxTimeMs(new_end * 1000);
        setCurrentTxTime(
            pct_to_value(
                new_current_time > new_first_tx_time ? 66 : 33,
                new_end * 1000,
                new_start * 1000
            )
        );
        setFirstTxTime(
            pct_to_value(
                new_current_time > new_first_tx_time ? 33 : 66,
                new_end * 1000,
                new_start * 1000
            )
        );
    };
    const first_tx_time_str = new Date(first_tx_time_ms).toLocaleString(
        undefined,
        {
            timeZone: 'UTC',
        }
    );
    const current_time_str = new Date(current_time_ms).toLocaleString(
        undefined,
        {
            timeZone: 'UTC',
        }
    );
    const to_time_str = (t: Date) =>
        `${t.getUTCFullYear()}-${t
            .getUTCMonth()
            .toString()
            .padStart(2, '0')}-${t
            .getUTCDay()
            .toString()
            .padStart(2, '0')}T${t
            .getUTCHours()
            .toString()
            .padStart(2, '0')}:${t
            .getUTCMinutes()
            .toString()
            .padStart(2, '0')}`;
    const max_time_str = to_time_str(new Date(max_time_ms));
    const min_time_str = to_time_str(new Date(min_time_ms));
    const ClockControl = (
        <div className="Controler">
            <div className="ControlerSliders">
                <Slider
                    value={[first_tx_time_ms, current_time_ms]}
                    valueLabelFormat={(value: number, index: number) => {
                        const d = new Date(value);
                        return (
                            <div>
                                <Typography>
                                    {d.toLocaleDateString()}
                                </Typography>
                                <p>{d.toLocaleTimeString()}</p>
                            </div>
                        );
                    }}
                    step={1000}
                    min={min_time_ms}
                    max={max_time_ms}
                    valueLabelDisplay="on"
                    onChange={updateTimes}
                />
            </div>
            <div className="ControlerSettings">
                <h6> Date</h6>
                <TextField
                    label="Start Time"
                    type="datetime-local"
                    defaultValue={min_time_str}
                    onChange={updateMinTime}
                    InputLabelProps={{
                        shrink: true,
                    }}
                />
                <TextField
                    label="End Time"
                    type="datetime-local"
                    defaultValue={max_time_str}
                    onChange={updateMaxTime}
                    InputLabelProps={{
                        shrink: true,
                    }}
                />

                <Tooltip title="Click to Snap Time">
                    <IconButton aria-label="snap-time" onClick={snapTime}>
                        <MoreHorizOutlinedIcon style={{ color: green[500] }} />
                    </IconButton>
                </Tooltip>
            </div>
        </div>
    );

    const BlockControl = (
        <div className="Controler">
            <div className="ControlerSliders">
                <Slider
                    value={[first_tx_block, current_block]}
                    min={min_blocks}
                    max={max_blocks}
                    valueLabelDisplay="on"
                    onChange={updateBlocks}
                />
            </div>
            <div className="ControlerSettings">
                <h6> Height</h6>
                <div>
                    <TextField
                        label="Start Height"
                        value={min_blocks}
                        type="number"
                        onChange={updateMinBlocks}
                    />
                </div>
                <div>
                    <TextField
                        label="End Height"
                        value={max_blocks}
                        type="number"
                        onChange={updateMaxBlocks}
                    />
                </div>

                <Tooltip title="Click to Snap Blocks">
                    <IconButton aria-label="snap-blocks" onClick={snapBlocks}>
                        <MoreHorizOutlinedIcon style={{ color: green[500] }} />
                    </IconButton>
                </Tooltip>
            </div>
        </div>
    );
    return (
        <form
            onSubmit={(e: React.FormEvent) => e.preventDefault()}
            className="Simulation"
        >
            <Tooltip title="Close Simulator">
                <IconButton aria-label="close-sim" onClick={props.hide}>
                    <CancelOutlinedIcon style={{ color: red[500] }} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Hide Simulator Results">
                <IconButton aria-label="hide-sim" onClick={clear}>
                    <VisibilityOffOutlinedIcon style={{ color: pink[500] }} />
                </IconButton>
            </Tooltip>
            <div className="Controlers">
                {BlockControl}
                {ClockControl}
            </div>
        </form>
    );
}
