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
type Field =
    | 'current_time'
    | 'first_tx_time'
    | 'min_time'
    | 'max_time'
    | 'current_block'
    | 'first_tx_block'
    | 'min_blocks'
    | 'max_blocks'
    | 'none';
type SimAction = 'clear' | 'snap-time' | 'snap-blocks';
export class SimulationController extends React.Component<
    {
        contract: ContractModel;
        engine: DiagramEngine;
    },
    {
        date: Date;
        min_time: Date;
        max_time: Date;
        first_tx_time: Date;
        current_time: Date;
        first_tx_time_pct: number;
        current_time_pct: number;
        first_tx_block: number;
        current_block: number;
        first_tx_block_pct: number;
        current_block_pct: number;
        min_blocks: number;
        max_blocks: number;
    }
> {
    current_time: number;
    first_tx_time: number;
    min_time: Date;
    max_time: Date;
    current_block: number;
    first_tx_block: number;
    min_blocks: number;
    max_blocks: number;
    timeout: NodeJS.Timeout;
    throttled_update: () => void;
    constructor(props: any) {
        super(props);
        this.current_time = 0.5;
        this.first_tx_time = 0;
        this.min_time = new Date(Date.now());
        this.max_time = new Date(Date.now());
        this.max_time.setDate(this.max_time.getDate() + 365);
        this.current_block = 0.5;
        this.first_tx_block = 0;
        const prefs = window.electron.get_preferences_sync();
        if (prefs['bitcoin-config'].network === 'regtest') {
            this.min_blocks = 0;
            this.max_blocks = 1000;
        } else {
            this.min_blocks = Math.round(
                (new Date().getFullYear() - 2008) * 144 * 365 - (144 * 365) / 2
            );
            this.max_blocks = this.min_blocks + 144 * 365;
        }
        this.timeout = setTimeout(() => null, 0);
        this.state = {
            date: new Date(),
            first_tx_time: new Date(),
            current_time: new Date(),
            // Start at 0 to make scaling work right away
            first_tx_time_pct: 0,
            current_time_pct: 50,
            min_time: this.min_time,
            max_time: this.max_time,
            first_tx_block:
                (this.max_blocks - this.min_blocks) * this.first_tx_block +
                this.min_blocks,
            current_block:
                (this.max_blocks - this.min_blocks) * this.current_block +
                this.min_blocks,
            first_tx_block_pct: 0,
            current_block_pct: 50,
            min_blocks: this.min_blocks,
            max_blocks: this.max_blocks,
        };

        this.throttled_update = _.throttle(() => this.delayedUpdate(), 30, {
            trailing: true,
            leading: false,
        });
    }
    changeHandler(from: Field, e: FormEvent) {
        const input = e.currentTarget as HTMLInputElement;
        switch (from) {
            case 'min_time':
                this.min_time = input.valueAsDate ?? this.min_time;
                this.setState({ min_time: this.min_time });
                break;
            case 'first_tx_time':
                this.first_tx_time = input.valueAsNumber;
                this.setState({ first_tx_time_pct: this.first_tx_time });
                this.first_tx_time /= 100;
                break;
            case 'current_time':
                this.current_time = input.valueAsNumber;
                this.setState({ current_time_pct: this.current_time });
                this.current_time /= 100;
                break;
            case 'max_time':
                this.max_time = input.valueAsDate ?? this.max_time;
                this.setState({ max_time: this.max_time });
                break;
            case 'min_blocks':
                this.min_blocks = input.valueAsNumber;
                this.setState({ min_blocks: this.min_blocks });
                break;
            case 'current_block':
                this.current_block = input.valueAsNumber;

                this.setState({ current_block_pct: this.current_block });
                break;
            case 'first_tx_block':
                this.first_tx_block = input.valueAsNumber;
                this.setState({ first_tx_block_pct: this.first_tx_block });
                break;
            case 'max_blocks':
                this.max_blocks = input.valueAsNumber;
                this.setState({ max_blocks: this.max_blocks });
                break;
            case 'none':
                break;
        }
        const [
            [first_tx_time_secs, current_time_secs],
            [first_tx_block, current_block],
        ] = this.recompute_times();
        const first_tx_time = new Date(first_tx_time_secs * 1000);
        const current_time = new Date(current_time_secs * 1000);
        this.setState({
            first_tx_time,
            current_time,
            first_tx_block,
            current_block,
        });
        this.throttled_update();
    }
    recompute_times(): [[number, number], [number, number]] {
        const time_delta = this.max_time.getTime() - this.min_time.getTime();
        const current_time =
            this.current_time * time_delta + this.min_time.getTime();
        const first_tx_time =
            this.first_tx_time * time_delta + this.min_time.getTime();
        const block_delta = (this.max_blocks - this.min_blocks) / 100.0;
        const current_block = Math.round(
            block_delta * this.current_block + this.min_blocks
        );
        const first_tx_block = Math.round(
            block_delta * this.first_tx_block + this.min_blocks
        );
        return [
            [first_tx_time / 1000, current_time / 1000],
            [first_tx_block, current_block],
        ];
    }
    delayedUpdate() {
        const [
            [first_tx_time, current_time],
            [first_tx_block, current_block],
        ] = this.recompute_times();
        const unreachable = this.props.contract.reachable_at_time(
            current_time,
            current_block,
            first_tx_time,
            first_tx_block
        );
        const date = new Date(current_time * 1000);
        this.setState({ date });
        this.updateForUnreachable(unreachable);
    }
    updateForUnreachable(unreachable: Array<TransactionModel>) {
        this.props.contract.txn_models.forEach((m) => {
            m.setReachable(true);
        });
        unreachable.forEach((m) => {
            m.setReachable(false);
        });
        setTimeout(() => {
            this.props.engine.repaintCanvas();
        }, 0);
    }
    handleSubmit(e: SimAction) {
        switch (e) {
            case 'clear':
                setTimeout(() => this.updateForUnreachable([]), 0);
                break;
            case 'snap-time':
                {
                    const [
                        [first_tx_time, current_time],
                        _,
                    ] = this.recompute_times();
                    if (first_tx_time === current_time) return;

                    let new_start = Math.min(first_tx_time, current_time);
                    // at least one day...
                    let new_end = Math.max(
                        first_tx_time,
                        current_time,
                        new_start + 24 * 60 * 60
                    );
                    let delta = Math.abs(current_time - first_tx_time);
                    new_start -= delta;
                    new_end += delta;

                    this.current_time =
                        current_time > first_tx_time ? 0.66 : 0.33;
                    this.first_tx_time =
                        current_time > first_tx_time ? 0.33 : 0.66;

                    this.min_time = new Date(new_start * 1000);
                    this.max_time = new Date(new_end * 1000);
                    this.setState({
                        min_time: this.min_time,
                        max_time: this.max_time,
                        current_time_pct: this.current_time * 100,
                        first_tx_time_pct: this.first_tx_time * 100,
                    });
                }
                break;
            case 'snap-blocks':
                {
                    const [
                        _,
                        [first_tx_block, current_block],
                    ] = this.recompute_times();
                    if (first_tx_block === current_block) return;

                    let new_start = Math.min(first_tx_block, current_block);
                    // at least one day...
                    let new_end = Math.max(
                        first_tx_block,
                        current_block,
                        new_start + 144
                    );
                    let delta = Math.abs(current_block - first_tx_block);
                    new_start = Math.max(new_start - delta, 0);
                    new_end += delta;

                    this.current_block =
                        current_block > first_tx_block ? 0.66 : 0.33;
                    this.first_tx_block =
                        current_block > first_tx_block ? 0.33 : 0.66;

                    this.min_blocks = Math.round(new_start);
                    this.max_blocks = Math.round(new_end);
                    this.setState({
                        min_blocks: new_start,
                        max_blocks: new_end,
                        first_tx_block_pct: this.first_tx_block * 100,
                        current_block_pct: this.current_time * 100,
                    });
                }
                break;
        }
    }
    render() {
        const changeHandler = this.changeHandler.bind(this);
        return (
            <Form
                onSubmit={(e: React.FormEvent) => e.preventDefault()}
                className="Simulation"
            >
                <Form.Group as={Row}>
                    <Col sm={1}>
                        <h3>Block</h3>
                    </Col>
                    <Col sm={{ span: 2 }}>
                        <h6>Start Height</h6>
                        <Form.Control
                            value={this.state.min_blocks}
                            type="number"
                            onChange={(e: FormEvent) =>
                                changeHandler('min_blocks', e)
                            }
                        ></Form.Control>
                    </Col>
                    <Col sm={7}>
                        <Form.Label>
                            First Tx {this.state.first_tx_block}{' '}
                        </Form.Label>
                        <Form.Control
                            value={this.state.first_tx_block_pct}
                            type="range"
                            onChange={(e: FormEvent) =>
                                changeHandler('first_tx_block', e)
                            }
                        />
                    </Col>
                    <Col sm={2}>
                        <h6 style={{ visibility: 'hidden' }}>.</h6>
                        <Button
                            onClick={() => this.handleSubmit('snap-blocks')}
                            name={'action'}
                            value={'snap-blocks'}
                        >
                            Snap Blocks
                        </Button>
                    </Col>
                </Form.Group>

                <Form.Group as={Row}>
                    <Col sm={{ span: 2, offset: 1 }}>
                        <h6>End Height</h6>
                        <Form.Control
                            value={this.state.max_blocks}
                            type="number"
                            onChange={(e: FormEvent) =>
                                changeHandler('max_blocks', e)
                            }
                        ></Form.Control>
                    </Col>
                    <Col sm={7}>
                        <Form.Label>
                            Current Block {this.state.current_block}{' '}
                        </Form.Label>
                        <Form.Control
                            value={this.state.current_block_pct}
                            type="range"
                            onChange={(e: FormEvent) =>
                                changeHandler('current_block', e)
                            }
                        />
                    </Col>
                    <Col sm={2}></Col>
                </Form.Group>
                <Form.Group as={Row}>
                    <Col sm={1}>
                        <h3>Clock</h3>
                    </Col>
                    <Col sm={{ span: 2 }}>
                        <h6>Start Date</h6>
                        <Form.Control
                            value={this.state.min_time.toLocaleDateString(
                                'en-CA',
                                {
                                    timeZone: 'UTC',
                                }
                            )}
                            type="date"
                            onChange={(e: FormEvent) =>
                                changeHandler('min_time', e)
                            }
                        ></Form.Control>
                    </Col>
                    <Col sm={7}>
                        <Form.Label>
                            First Tx{' '}
                            {this.state.first_tx_time.toLocaleString(
                                undefined,
                                {
                                    timeZone: 'UTC',
                                }
                            )}
                        </Form.Label>
                        <Form.Control
                            value={this.state.first_tx_time_pct}
                            type="range"
                            onChange={(e: FormEvent) =>
                                changeHandler('first_tx_time', e)
                            }
                        ></Form.Control>
                    </Col>

                    <Col sm={2}>
                        <h6 style={{ visibility: 'hidden' }}>.</h6>
                        <Button
                            onClick={() => this.handleSubmit('snap-time')}
                            name={'action'}
                            value={'snap-time'}
                        >
                            Snap Time
                        </Button>
                    </Col>
                </Form.Group>

                <Form.Group as={Row}>
                    <Col sm={{ span: 2, offset: 1 }}>
                        <h6>End Date</h6>
                        <Form.Control
                            value={this.state.max_time.toLocaleDateString(
                                'en-CA',
                                {
                                    timeZone: 'UTC',
                                }
                            )}
                            type="date"
                            onChange={(e: FormEvent) =>
                                changeHandler('max_time', e)
                            }
                        ></Form.Control>
                    </Col>
                    <Col sm={7}>
                        <Form.Label>
                            {' '}
                            Current Time{' '}
                            {this.state.current_time.toLocaleString(undefined, {
                                timeZone: 'UTC',
                            })}{' '}
                        </Form.Label>
                        <Form.Control
                            value={this.state.current_time_pct}
                            type="range"
                            onChange={(e: FormEvent) =>
                                changeHandler('current_time', e)
                            }
                        ></Form.Control>
                    </Col>

                    <Col sm={2}>
                        <h6 style={{ visibility: 'hidden' }}>.</h6>
                        <Button
                            onClick={() => this.handleSubmit('clear')}
                            name={'action'}
                            value={'clear'}
                            variant="danger"
                        >
                            Clear
                        </Button>
                    </Col>
                </Form.Group>
            </Form>
        );
    }
}
