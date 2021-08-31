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
    const [min_time, setMinTime] = React.useState(new Date(Date.now()));
    const [max_time, setMaxTime] = React.useState(
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    );
    const current_time = () =>
        new Date(
            (max_time.getTime() - min_time.getTime()) *
                (current_time_pct / 100.0) +
                min_time.getTime()
        );
    const first_tx_time = () =>
        new Date(
            (max_time.getTime() - min_time.getTime()) *
                (first_tx_time_pct / 100.0) +
                min_time.getTime()
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
    const updateForUnreachable = (unreachable: Array<TransactionModel>) => {
        let r: Record<TXID, null> = {};
        for (const model of unreachable) {
            r[model.get_txid()] = null;
        }
        dispatch(set_unreachable(r));
    };
    const changeFinalizer = () => {
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
        setMinTime(input.valueAsDate ?? min_time);
    });
    const updateFirstTxTime = wrapper((input: HTMLInputElement) => {
        setFirstTxTimePct(input.valueAsNumber);
    });
    const updateCurrentTime = wrapper((input: HTMLInputElement) => {
        setCurrentTimePct(input.valueAsNumber);
    });
    const updateMaxTime = wrapper((input: HTMLInputElement) => {
        setMaxTime(input.valueAsDate ?? max_time);
    });
    const updateMinBlocks = wrapper((input: HTMLInputElement) => {
        setMinBlocks(input.valueAsNumber);
    });
    const updateCurrentBlock = wrapper((input: HTMLInputElement) => {
        setCurrentBlockPct(input.valueAsNumber);
    });
    const updateFirstTxBlock = wrapper((input: HTMLInputElement) => {
        setFirstTxBlockPct(input.valueAsNumber);
    });
    const updateMaxBlocks = wrapper((input: HTMLInputElement) => {
        setMaxBlocks(input.valueAsNumber);
    });
    const immediateUpdate = () => {
        const unreachable = props.contract.reachable_at_time(
            current_time().getTime() / 1000,
            current_block(),
            first_tx_time().getTime() / 1000,
            first_tx_block()
        );
        updateForUnreachable(unreachable);
    };

    const throttled_update = _.throttle(immediateUpdate, 30, {
        trailing: true,
        leading: false,
    });
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
        const new_first_tx_time = first_tx_time().getTime() / 1000;
        const new_current_time = current_time().getTime() / 1000;
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

        setMinTime(new Date(new_start * 1000));
        setMaxTime(new Date(new_end * 1000));
        setCurrentTimePct(new_current_time > new_first_tx_time ? 66 : 33);
        setFirstTxTimePct(new_current_time > new_first_tx_time ? 33 : 66);
    };
    return (
        <Form
            onSubmit={(e: React.FormEvent) => e.preventDefault()}
            className="Simulation"
        >
            <Button
                onClick={props.hide}
                name={'action'}
                value={'hide'}
                variant="link"
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
                variant="link"
            >
                <span
                    className="glyphicon glyphicon-erase"
                    style={{ color: 'pink' }}
                ></span>
            </Button>
            <BlockControl
                min_blocks={min_blocks}
                first_tx_block_pct={first_tx_block_pct}
                first_tx_block={first_tx_block()}
                current_block={current_block()}
                current_block_pct={current_block_pct}
                max_blocks={max_blocks}
                updateMinBlocks={updateMinBlocks}
                updateMaxBlocks={updateMaxBlocks}
                updateFirstTxBlock={updateFirstTxBlock}
                updateCurrentBlock={updateCurrentBlock}
                snapBlocks={snapBlocks}
            />
            <hr></hr>
            <ClockControl
                min_time={min_time}
                max_time={max_time}
                first_tx_time={first_tx_time()}
                first_tx_time_pct={first_tx_time_pct}
                current_time={current_time()}
                current_time_pct={current_time_pct}
                updateMinTime={updateMinTime}
                updateMaxTime={updateMaxTime}
                updateCurrentTime={updateCurrentTime}
                updateFirstTxTime={updateFirstTxTime}
                snapTime={snapTime}
            />
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
            <div className="ControlerSettings">
                <h6>Start Date</h6>
                <Form.Control
                    value={props.min_time.toLocaleDateString('en-CA', {
                        timeZone: 'UTC',
                    })}
                    type="date"
                    onChange={props.updateMinTime}
                ></Form.Control>
                <h6>End Date</h6>
                <Form.Control
                    value={props.max_time.toLocaleDateString('en-CA', {
                        timeZone: 'UTC',
                    })}
                    type="date"
                    onChange={props.updateMaxTime}
                ></Form.Control>

                <Button
                    onClick={props.snapTime}
                    name={'action'}
                    value={'snap-time'}
                >
                    Snap Time
                </Button>
            </div>
            <div className="ControlerSliders">
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
            <div className="ControlerSettings">
                <h6>Start Height</h6>
                <Form.Control
                    value={props.min_blocks}
                    type="number"
                    onChange={props.updateMinBlocks}
                ></Form.Control>
                <h6>End Height</h6>
                <Form.Control
                    value={props.max_blocks}
                    type="number"
                    onChange={props.updateMaxBlocks}
                ></Form.Control>

                <Button
                    onClick={props.snapBlocks}
                    name={'action'}
                    value={'snap-blocks'}
                >
                    Snap Blocks
                </Button>
            </div>
            <div className="ControlerSliders">
                <Form.Label>First Tx {props.first_tx_block} </Form.Label>
                <Form.Control
                    value={props.first_tx_block_pct}
                    type="range"
                    onChange={props.updateFirstTxBlock}
                />

                <Form.Label>Current Block {props.current_block} </Form.Label>
                <Form.Control
                    value={props.current_block_pct}
                    type="range"
                    onChange={props.updateCurrentBlock}
                />
            </div>
        </div>
    );
}
