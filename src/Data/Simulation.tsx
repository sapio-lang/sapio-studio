import React, { FormEvent } from 'react';
import { ContractModel } from '../Data/ContractManager';

import _ from 'lodash';
import './Simulation.css';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { useDispatch } from 'react-redux';
import { set_unreachable } from './SimulationSlice';
import { TXID } from '../util';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import Tooltip from 'react-bootstrap/esm/Tooltip';
import { Button, Slider, TextField, Typography } from '@material-ui/core';
import { ChangeEvent } from 'react-transition-group/node_modules/@types/react';
export function SimulationController(props: {
    contract: ContractModel;
    engine: DiagramEngine;
    hide: () => void;
}) {
    const dispatch = useDispatch();
    const prefs = window.electron.get_preferences_sync();
    // Start at 0 to make scaling work riht away
    const [first_tx_time_pct, setFirstTxTimePct] = React.useState(0);
    const [current_time_pct, setCurrentTimePct] = React.useState(50);
    const [min_time_ms, setMinTimeMs] = React.useState(Date.now());
    const [max_time_ms, setMaxTimeMs] = React.useState(
        Date.now() + 365 * 24 * 60 * 60 * 1000
    );
    const current_time_ms = () =>
        (max_time_ms - min_time_ms) * (current_time_pct / 100.0) + min_time_ms;
    const first_tx_time_ms = () =>
        (max_time_ms - min_time_ms) * (first_tx_time_pct / 100.0) + min_time_ms;
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
    const [first_tx_block_pct, setFirstTxBlockPct] = React.useState(33);
    const [current_block_pct, setCurrentBlockPct] = React.useState(66);
    const current_block = () =>
        Math.round((current_block_pct / 100) * (max_blocks - min_blocks)) +
        min_blocks;
    const first_tx_block = () =>
        Math.round((first_tx_block_pct / 100) * (max_blocks - min_blocks)) +
        min_blocks;
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
    const updateBlocks = (e: ChangeEvent<{}>, n: number | number[]) => {
        if (typeof n !== 'number') {
            if (n.length === 2) {
                setFirstTxBlockPct(n[0]!);
                setCurrentBlockPct(n[1]!);
            }
        }
    };
    const updateTimes = (e: ChangeEvent<{}>, n: number | number[]) => {
        if (typeof n !== 'number') {
            if (n.length === 2) {
                setFirstTxTimePct(n[0]!);
                setCurrentTimePct(n[1]!);
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
            current_time_ms() / 1000,
            current_block(),
            first_tx_time_ms() / 1000,
            first_tx_block()
        );
        let r: Record<TXID, null> = {};
        for (const model of unreachable) {
            r[model.get_txid()] = null;
        }
        dispatch(set_unreachable(r));
    }, [
        first_tx_block_pct,
        first_tx_time_pct,
        max_blocks,
        min_blocks,
        max_time_ms,
        min_time_ms,
        current_time_pct,
        current_block_pct,
    ]);

    const snapBlocks = () => {
        const new_first_tx_block = first_tx_block();
        const new_current_block = current_block();
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
        setFirstTxBlockPct(new_current_block > new_first_tx_block ? 33 : 66);
        setCurrentBlockPct(new_current_block > new_first_tx_block ? 66 : 33);
    };
    const snapTime = () => {
        // work in seconds
        const new_first_tx_time = first_tx_time_ms() / 1000;
        const new_current_time = current_time_ms() / 1000;
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
        setCurrentTimePct(new_current_time > new_first_tx_time ? 66 : 33);
        setFirstTxTimePct(new_current_time > new_first_tx_time ? 33 : 66);
    };
    const first_tx_time_str = new Date(first_tx_time_ms()).toLocaleString(
        undefined,
        {
            timeZone: 'UTC',
        }
    );
    const current_time_str = new Date(current_time_ms()).toLocaleString(
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
                <OverlayTrigger
                    placement={'top'}
                    overlay={
                        <Tooltip id="snap-time-tooltip">
                            Click me to Snap Time.
                        </Tooltip>
                    }
                >
                    <Button
                        onClick={snapTime}
                        name={'action'}
                        value={'snap-time'}
                        variant="text"
                    >
                        <i
                            className="glyphicon glyphicon-resize-horizontal"
                            style={{ color: 'green' }}
                        ></i>
                    </Button>
                </OverlayTrigger>
            </div>
            <div className="ControlerSliders">
                <Typography id="slider-first-tx-time" gutterBottom>
                    {first_tx_time_str} till {current_time_str}
                </Typography>

                <Slider
                    value={[first_tx_time_pct, current_time_pct]}
                    aria-labelledby="slider-first-tx-time"
                    aria-valuetext={first_tx_time_str}
                    step={1}
                    marks
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    onChange={updateTimes}
                />
            </div>
        </div>
    );

    const BlockControl = (
        <div className="Controler">
            <form className="ControlerSettings">
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

                <OverlayTrigger
                    placement={'top'}
                    overlay={
                        <Tooltip id="snap-blocks-tooltip">
                            Click me to Snap Blocks.
                        </Tooltip>
                    }
                >
                    <Button
                        onClick={snapBlocks}
                        name={'action'}
                        value={'snap-blocks'}
                        variant="text"
                    >
                        <i
                            className="glyphicon glyphicon-resize-horizontal"
                            style={{ color: 'green' }}
                        ></i>
                    </Button>
                </OverlayTrigger>
            </form>
            <div className="ControlerSliders">
                <Typography id="slider-blocks" gutterBottom>
                    {first_tx_block()} till {current_block()}
                </Typography>
                <Slider
                    value={[first_tx_block_pct, current_block_pct]}
                    aria-labelledby="discrete-slider-small-steps"
                    step={1}
                    marks
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    onChange={updateBlocks}
                />
            </div>
        </div>
    );
    return (
        <form
            onSubmit={(e: React.FormEvent) => e.preventDefault()}
            className="Simulation"
        >
            <Button
                onClick={props.hide}
                name={'action'}
                value={'hide'}
                variant="text"
            >
                <span
                    className="glyphicon glyphicon-remove"
                    style={{ color: 'red' }}
                ></span>
            </Button>
            <Button
                onClick={clear}
                name={'action'}
                value={'clear'}
                variant="text"
            >
                <span
                    className="glyphicon glyphicon-erase"
                    style={{ color: 'pink' }}
                ></span>
            </Button>
            <div className="Controlers">
                {BlockControl}
                {ClockControl}
            </div>
        </form>
    );
}
