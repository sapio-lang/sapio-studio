import React, { FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { ContractModel } from './Data/ContractManager';
import Form from 'react-bootstrap/Form';
import { TransactionModel } from './Data/Transaction';
import Button from 'react-bootstrap/Button';
import _ from 'lodash';
import './Simulation.css';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import { current } from 'immer';
import { useDispatch } from 'react-redux';
import { set_unreachable } from './SimulationSlice';
import { TXID } from './util';
const recompute_times = (
    max_time: Date,
    min_time: Date,
    first_tx_block: number,
    current_block: number,
    first_tx_time: number,
    max_blocks: number,
    current_time: number,
    min_blocks: number
): [[number, number], [number, number]] => {
    const time_delta = max_time.getTime() - min_time.getTime();
    const current_time_tmp = current_time * time_delta + min_time.getTime();
    const first_tx_time_tmp = first_tx_time * time_delta + min_time.getTime();
    const block_delta = (max_blocks - min_blocks) / 100.0;
    const current_block_tmp = Math.round(
        block_delta * current_block + min_blocks
    );
    const first_tx_block_tmp = Math.round(
        block_delta * first_tx_block + min_blocks
    );
    return [
        [first_tx_time_tmp / 1000, current_time_tmp / 1000],
        [first_tx_block_tmp, current_block_tmp],
    ];
};
export function SimulationController(props: {
    contract: ContractModel;
    engine: DiagramEngine;
}) {
    const dispatch = useDispatch();
    let locals = {
        current_time: 0.5,
        first_tx_time: 0,
        min_time: new Date(Date.now()),
        max_time: new Date(Date.now()),
        current_block: 0.5,
        first_tx_block: 0,
        min_blocks: 0,
        max_blocks: 0,
    };
    locals.max_time.setDate(locals.max_time.getDate() + 365);
    const prefs = window.electron.get_preferences_sync();
    if (prefs['bitcoin-config'].network === 'regtest') {
        locals.min_blocks = 0;
        locals.max_blocks = 1000;
    } else {
        locals.min_blocks = Math.round(
            (new Date().getFullYear() - 2008) * 144 * 365 - (144 * 365) / 2
        );
        locals.max_blocks = locals.min_blocks + 144 * 365;
    }
    const [date, setDate] = React.useState(new Date());
    const [first_tx_time, setFirstTxTime] = React.useState(new Date());
    const [current_time, setCurrentTime] = React.useState(new Date());
    // Start at 0 to make scaling work riht away
    const [first_tx_time_pct, setFirstTxTimePct] = React.useState(0);
    const [current_time_pct, setCurrentTimePct] = React.useState(50);
    const [min_time, setMinTime] = React.useState(locals.min_time);
    const [max_time, setMaxTime] = React.useState(locals.max_time);
    const [first_tx_block, setFirstTxBlock] = React.useState(
        (locals.max_blocks - locals.min_blocks) * locals.first_tx_block +
            locals.min_blocks
    );
    const [current_block, setCurrentBlock] = React.useState(
        (locals.max_blocks - locals.min_blocks) * locals.current_block +
            locals.min_blocks
    );
    const [first_tx_block_pct, setFirstTxBlockPct] = React.useState(0);
    const [current_block_pct, setCurrentBlockPct] = React.useState(50);
    const [min_blocks, setMinBlocks] = React.useState(locals.min_blocks);
    const [max_blocks, setMaxBlocks] = React.useState(locals.max_blocks);

    const changeFinalizer = () => {
        const [
            [first_tx_time_secs, current_time_secs],
            [first_tx_block, current_block],
        ] = recompute_times(
            locals.max_time,
            locals.min_time,
            locals.first_tx_block,
            locals.current_block,
            locals.first_tx_time,
            locals.max_blocks,
            locals.current_time,
            locals.min_blocks
        );
        const first_tx_time = new Date(first_tx_time_secs * 1000);
        const current_time = new Date(current_time_secs * 1000);
        setFirstTxTime(first_tx_time);
        setCurrentTime(current_time);
        setFirstTxBlock(first_tx_block);
        setCurrentBlock(current_block);
        throttled_update();
    };
    const wrapper = (f: (input: HTMLInputElement) => void) => (
        e: FormEvent
    ) => {
        const input = e.currentTarget as HTMLInputElement;
        f(input);
        changeFinalizer();
    };

    const updateMinTime = wrapper((input: HTMLInputElement) => {
        locals.min_time = input.valueAsDate ?? locals.min_time;
        setMinTime(locals.min_time);
    });
    const updateFirstTxTime = wrapper((input: HTMLInputElement) => {
        locals.first_tx_time = input.valueAsNumber;
        setFirstTxTimePct(locals.first_tx_time);
        locals.first_tx_time /= 100;
    });
    const updateCurrentTime = wrapper((input: HTMLInputElement) => {
        locals.current_time = input.valueAsNumber;
        setCurrentTimePct(locals.current_time);
        locals.current_time /= 100;
    });
    const updateMaxTime = wrapper((input: HTMLInputElement) => {
        locals.max_time = input.valueAsDate ?? locals.max_time;
        setMaxTime(locals.max_time);
    });
    const updateMinBlocks = wrapper((input: HTMLInputElement) => {
        locals.min_blocks = input.valueAsNumber;
        setMinBlocks(locals.min_blocks);
    });
    const updateCurrentBlock = wrapper((input: HTMLInputElement) => {
        locals.current_block = input.valueAsNumber;
        setCurrentBlockPct(locals.current_block);
    });
    const updateFirstTxBlock = wrapper((input: HTMLInputElement) => {
        locals.first_tx_block = input.valueAsNumber;
        setFirstTxBlockPct(locals.first_tx_block);
    });
    const updateMaxBlocks = wrapper((input: HTMLInputElement) => {
        locals.max_blocks = input.valueAsNumber;
        setMaxBlocks(locals.max_blocks);
    });
    const immediateUpdate = () => {
        const [
            [first_tx_time, current_time],
            [first_tx_block, current_block],
        ] = recompute_times(
            locals.max_time,
            locals.min_time,
            locals.first_tx_block,
            locals.current_block,
            locals.first_tx_time,
            locals.max_blocks,
            locals.current_time,
            locals.min_blocks
        );
        const unreachable = props.contract.reachable_at_time(
            current_time,
            current_block,
            first_tx_time,
            first_tx_block
        );
        const date = new Date(current_time * 1000);
        setDate(date);
        updateForUnreachable(unreachable);
    };

    const throttled_update = _.throttle(immediateUpdate, 30, {
        trailing: true,
        leading: false,
    });
    const updateForUnreachable = (unreachable: Array<TransactionModel>) => {
        let r: Record<TXID, null> = {};
        for (const model of unreachable) {
            r[model.get_txid()] = null;
        }
        dispatch(set_unreachable(r));
    };
    const snapBlocks = () => {
        const [_, [new_first_tx_block, current_block]] = recompute_times(
            locals.max_time,
            locals.min_time,
            locals.first_tx_block,
            locals.current_block,
            locals.first_tx_time,
            locals.max_blocks,
            locals.current_time,
            locals.min_blocks
        );
        if (new_first_tx_block === current_block) return;

        let new_start = Math.min(new_first_tx_block, current_block);
        // at least one day...
        let new_end = Math.max(
            new_first_tx_block,
            current_block,
            new_start + 144
        );
        let delta = Math.abs(current_block - new_first_tx_block);
        new_start = Math.max(new_start - delta, 0);
        new_end += delta;

        locals.current_block = current_block > new_first_tx_block ? 0.66 : 0.33;
        locals.first_tx_block =
            current_block > new_first_tx_block ? 0.33 : 0.66;

        locals.min_blocks = Math.round(new_start);
        locals.max_blocks = Math.round(new_end);
        setMinBlocks(new_start);
        setMaxBlocks(new_end);
        setFirstTxBlockPct(new_first_tx_block * 100);
        setCurrentBlockPct(current_block * 100);
    };
    const clear = () => {
        setTimeout(() => updateForUnreachable([]), 0);
        dispatch(set_unreachable({}));
    };
    const snapTime = () => {
        const [[new_first_tx_time, new_current_time], _] = recompute_times(
            locals.max_time,
            locals.min_time,
            locals.first_tx_block,
            locals.current_block,
            locals.first_tx_time,
            locals.max_blocks,
            locals.current_time,
            locals.min_blocks
        );
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

        locals.current_time =
            new_current_time > new_first_tx_time ? 0.66 : 0.33;
        locals.first_tx_time =
            new_current_time > new_first_tx_time ? 0.33 : 0.66;

        locals.min_time = new Date(new_start * 1000);
        locals.max_time = new Date(new_end * 1000);
        setMinTime(locals.min_time);
        setMaxTime(locals.max_time);
        setCurrentTimePct(locals.current_time * 100);
        setFirstTxTimePct(locals.first_tx_time * 100);
    };
    return (
        <Form
            onSubmit={(e: React.FormEvent) => e.preventDefault()}
            className="Simulation"
        >
            <BlockControl
                min_blocks={min_blocks}
                first_tx_block_pct={first_tx_block_pct}
                first_tx_block={first_tx_block}
                current_block={current_block}
                current_block_pct={current_block_pct}
                max_blocks={max_blocks}
                updateMinBlocks={updateMinBlocks}
                updateMaxBlocks={updateMaxBlocks}
                updateFirstTxBlock={updateFirstTxBlock}
                updateCurrentBlock={updateCurrentBlock}
                snapBlocks={snapBlocks}
            />
            <ClockControl
                min_time={min_time}
                max_time={max_time}
                first_tx_time={first_tx_time}
                first_tx_time_pct={first_tx_time_pct}
                current_time={current_time}
                current_time_pct={current_time_pct}
                updateMinTime={updateMinTime}
                updateMaxTime={updateMaxTime}
                updateCurrentTime={updateCurrentTime}
                updateFirstTxTime={updateFirstTxTime}
                snapTime={snapTime}
            />

            <h6 style={{ visibility: 'hidden' }}>.</h6>
            <Button
                onClick={clear}
                name={'action'}
                value={'clear'}
                variant="danger"
            >
                Clear
            </Button>
        </Form>
    );
}
interface ClockControlProps {
    min_time: Date;
    max_time: Date;
    first_tx_time: Date;
    first_tx_time_pct: number;
    current_time: Date;
    current_time_pct: number;
    updateMinTime: (e: FormEvent) => void;
    updateMaxTime: (e: FormEvent) => void;
    updateCurrentTime: (e: FormEvent) => void;
    updateFirstTxTime: (e: FormEvent) => void;
    snapTime: () => void;
}
function ClockControl(props: ClockControlProps) {
    return (
        <div className="Controler">
            <h3>Clock</h3>
            <h6>Start Date</h6>
            <Form.Control
                value={props.min_time.toLocaleDateString('en-CA', {
                    timeZone: 'UTC',
                })}
                type="date"
                onChange={props.updateMinTime}
            ></Form.Control>
            <Form.Label>
                First Tx{' '}
                {props.first_tx_time.toLocaleString(undefined, {
                    timeZone: 'UTC',
                })}
            </Form.Label>
            <Form.Control
                value={props.first_tx_time_pct}
                type="range"
                onChange={props.updateFirstTxTime}
            ></Form.Control>
            <h6 style={{ visibility: 'hidden' }}>.</h6>
            <Button
                onClick={props.snapTime}
                name={'action'}
                value={'snap-time'}
            >
                Snap Time
            </Button>

            <h6>End Date</h6>
            <Form.Control
                value={props.max_time.toLocaleDateString('en-CA', {
                    timeZone: 'UTC',
                })}
                type="date"
                onChange={props.updateMaxTime}
            ></Form.Control>
            <Form.Label>
                {' '}
                Current Time{' '}
                {props.current_time.toLocaleString(undefined, {
                    timeZone: 'UTC',
                })}{' '}
            </Form.Label>
            <Form.Control
                value={props.current_time_pct}
                type="range"
                onChange={props.updateCurrentTime}
            ></Form.Control>
        </div>
    );
}
interface BlockControlProps {
    min_blocks: number;
    first_tx_block_pct: number;
    first_tx_block: number;
    current_block: number;
    current_block_pct: number;
    max_blocks: number;
    updateMinBlocks: (a1: FormEvent) => void;
    updateMaxBlocks: (a1: FormEvent) => void;
    updateFirstTxBlock: (a1: FormEvent) => void;
    updateCurrentBlock: (a1: FormEvent) => void;
    snapBlocks: () => void;
}
function BlockControl(props: BlockControlProps) {
    return (
        <div className="Controler">
            <h3>Block</h3>
            <h6>Start Height</h6>
            <Form.Control
                value={props.min_blocks}
                type="number"
                onChange={props.updateMinBlocks}
            ></Form.Control>
            <Form.Label>First Tx {props.first_tx_block} </Form.Label>
            <Form.Control
                value={props.first_tx_block_pct}
                type="range"
                onChange={props.updateFirstTxBlock}
            />
            <h6 style={{ visibility: 'hidden' }}>.</h6>
            <Button
                onClick={props.snapBlocks}
                name={'action'}
                value={'snap-blocks'}
            >
                Snap Blocks
            </Button>

            <h6>End Height</h6>
            <Form.Control
                value={props.max_blocks}
                type="number"
                onChange={props.updateMaxBlocks}
            ></Form.Control>
            <Form.Label>Current Block {props.current_block} </Form.Label>
            <Form.Control
                value={props.current_block_pct}
                type="range"
                onChange={props.updateCurrentBlock}
            />
        </div>
    );
}
