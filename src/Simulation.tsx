import React, { FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { ContractModel } from './Data/ContractManager';
import Form from 'react-bootstrap/Form';
import { App } from './App';
import { TransactionModel } from './Data/Transaction';
import Button from 'react-bootstrap/Button';
type Field = "current_time" | "first_tx_time" | "min_time" | "max_time" | "start_block" | "first_tx_block" | "min_blocks" | "max_blocks" | "none";
type SimAction = "clear";
export class SimulationController extends React.Component<{
    contract: ContractModel;
    app: App;
}, {
    date: Date;
    first_tx_time: Date;
    current_time: Date;
    first_tx_block: number;
    start_block: number;
}> {
    current_time: number;
    first_tx_time: number;
    min_time: Date;
    max_time: Date;
    start_block: number;
    first_tx_block: number;
    min_blocks: number;
    max_blocks: number;
    timeout: NodeJS.Timeout;
    constructor(props: any) {
        super(props);
        this.current_time = 0.5;
        this.first_tx_time = 0.5;
        this.min_time = new Date(Date.now());
        this.max_time = new Date(Date.now());
        this.max_time.setDate(this.max_time.getDate() + 365);
        this.start_block = 0.5;
        this.first_tx_block = 0.5;
        this.min_blocks = (new Date().getFullYear() - 2008) * 144 * 365 - 144 * 365 / 2;
        this.max_blocks = this.min_blocks + 144 * (365);
        this.timeout = setTimeout(() => null, 0);
        this.state = {
            date: new Date(),
            first_tx_time: new Date(),
            current_time: new Date(),
            first_tx_block: 0,
            start_block: 0,
        };


    }
    changeHandler(from: Field, e: FormEvent) {
        const input = e.currentTarget as HTMLInputElement;
        switch (from) {
            case "min_time":
                this.min_time = input.valueAsDate ?? this.min_time;
                break;
            case "first_tx_time":
                this.first_tx_time = input.valueAsNumber / 100.0;
                break;
            case "current_time":
                this.current_time = input.valueAsNumber / 100.0;
                break;
            case "max_time":
                this.max_time = input.valueAsDate ?? this.max_time;
                break;
            case "min_blocks":
                this.min_blocks = input.valueAsNumber;
                break;
            case "start_block":
                this.start_block = input.valueAsNumber / 100.0;
                break;
            case "first_tx_block":
                this.first_tx_block = input.valueAsNumber / 100.0;
                break;
            case "max_blocks":
                this.max_blocks = input.valueAsNumber;
                break;
            case "none":
                break
        }
        const [[first_tx_time_secs, start_time_secs], [first_tx_block, start_block]] = this.recompute_times()
        const first_tx_time = new Date(first_tx_time_secs * 1000)
        const current_time = new Date(start_time_secs * 1000);
        this.setState({ first_tx_time, current_time, first_tx_block, start_block });

        // wait a second from last update
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.delayedUpdate(), 200);
    }
    recompute_times(): [[number, number], [number, number]] {
        const time_delta = (this.max_time.getTime() - this.min_time.getTime());
        const current_time = this.current_time * time_delta + this.min_time.getTime();
        const first_tx_time = this.first_tx_time * time_delta + this.min_time.getTime();
        const block_delta = (this.max_blocks - this.min_blocks) / 100.0;
        const start_block = block_delta * this.start_block + this.min_blocks;
        const first_tx_block = block_delta * this.first_tx_block + this.min_blocks;
        return [[first_tx_time / 1000, current_time / 1000], [first_tx_block, start_block]];

    }
    delayedUpdate() {
        const [[first_tx_time, current_time], [first_tx_block, start_block]] = this.recompute_times()
        const unreachable = this.props.contract.reachable_at_time(current_time, start_block, first_tx_time, first_tx_block);
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
            this.props.app.engine.repaintCanvas();
            this.props.app.forceUpdate();
        }, 0);
    }
    handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (e.currentTarget instanceof HTMLFormElement) {
            const form = e.currentTarget as HTMLFormElement;
            const submitter: any = form.elements["action" as any];
            if (submitter instanceof HTMLButtonElement) {
                switch (submitter.name) {
                    case "action":
                        switch (submitter.value) {
                            case "clear":
                                setTimeout(() => this.updateForUnreachable([]), 0);
                                break;
                            case "snap-time":
                            case "snap-blocks":

                        }
                        break;

                    default:
                }
            }
        }

    }
    render() {
        const changeHandler = this.changeHandler.bind(this);
        return (<Form onSubmit={(e: React.FormEvent) => this.handleSubmit(e)}>
            <h2>Block Height</h2>
            <Form.Group as={Row}>
                <Col sm={2}>
                    <h6>Start Height</h6>
                    <Form.Control defaultValue={this.min_blocks} type="number" onChange={(e: FormEvent) => changeHandler("min_blocks", e)}></Form.Control>
                </Col>
                <Col sm={8}>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>First Tx</Form.Label>
                        </Col>
                        <Col sm={8}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("first_tx_block", e)} />
                        </Col>
                        <Col sm={2}>
                            {this.state.first_tx_block}
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>Current Block</Form.Label>
                        </Col>
                        <Col sm={8}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("start_block", e)} />
                        </Col>
                        <Col sm={2}>
                            {this.state.start_block}
                        </Col>
                    </Row>
                </Col>
                <Col sm={2}>
                    <h6>End Height</h6>
                    <Form.Control defaultValue={this.max_blocks} type="number" onChange={(e: FormEvent) => changeHandler("max_blocks", e)}></Form.Control>
                </Col>
            </Form.Group>
            <h2>Clock Time</h2>
            <Form.Group as={Row}>
                <Col sm={2}>
                    <h6>Start Date</h6>
                    <Form.Control defaultValue={this.min_time.toLocaleDateString("en-CA", {timeZone:'UTC'})} type="date" onChange={(e: FormEvent) => changeHandler("min_time", e)}></Form.Control>
                </Col>
                <Col sm={8}>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>First Tx</Form.Label>
                        </Col>
                        <Col sm={8}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("first_tx_time", e)}></Form.Control>
                        </Col>
                        <Col sm={2}>
                            {this.state.first_tx_time.toLocaleString(undefined, { timeZone: 'UTC' })};
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>Current Time</Form.Label>
                        </Col>
                        <Col sm={8}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("current_time", e)}></Form.Control>
                        </Col>
                        <Col sm={2}>
                            {this.state.current_time.toLocaleString(undefined, { timeZone: 'UTC' })};
                        </Col>
                    </Row>
                </Col>
                <Col sm={2}>
                    <h6>End Data</h6>
                    <Form.Control defaultValue={this.max_time.toLocaleDateString("en-CA", {timeZone: 'UTC'})} type="date" onChange={(e: FormEvent) => changeHandler("max_time", e)}></Form.Control>
                </Col>
            </Form.Group>
            <Form.Group as={Row}>
                <Col sm={{span: 3, offset:3}}>
                    Simulation Showing
                    <Form.Label >
                        {this.state.date.toLocaleString(undefined, {timeZone: 'UTC'})} UTC
                    </Form.Label>
                </Col>
                <Col sm={{span:1, offset:3}}>
                    <Button type="submit" name={"action"} value={"clear"}>Clear Results</Button>
                </Col>
                <Col sm={{span:1, offset:0}}>
                    <Button type="submit" name={"action"} value={"snap-time"}>Snap Time</Button>
                </Col>
                <Col sm={{span:1, offset:0}}>
                    <Button type="submit" name={"action"} value={"snap-blocks"}>Snap Blocks</Button>
                </Col>

            </Form.Group>
        </Form>);
    }
}
