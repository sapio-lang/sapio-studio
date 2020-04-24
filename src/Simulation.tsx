import React, { FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { ContractModel } from './Data/ContractManager';
import Form from 'react-bootstrap/Form';
import { App } from './App';
type Field = "start_time" | "first_tx_time" | "min_time" | "max_time" | "start_block" | "first_tx_block" | "min_blocks" | "max_blocks";
export class SimulationController extends React.Component<{
    contract: ContractModel;
    app: App;
}, {
    date: Date;
}> {
    start_time: number;
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
        this.start_time = 0.5;
        this.first_tx_time = 0.5;
        this.min_time = new Date(Date.now());
        this.max_time = new Date(Date.now());
        this.max_time.setDate(this.max_time.getDate() + 365);
        this.start_block = 0.5;
        this.first_tx_block = 0.5;
        this.min_blocks = (new Date().getFullYear() - 2008) * 144 * 365 - 144 * 365 / 2;
        this.max_blocks = this.min_blocks + 144 * (365);
        this.timeout = setTimeout(() => null, 0);
        this.state = { date: new Date() };
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
            case "start_time":
                this.start_time = input.valueAsNumber / 100.0;
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
        }
        // wait a second from last update
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.delayedUpdate(), 1000);
    }
    delayedUpdate() {
        const time_delta = (this.max_time.getTime() - this.min_time.getTime());
        const start_time = this.start_time * time_delta + this.min_time.getTime();
        const first_tx_time = this.first_tx_time * time_delta + this.min_time.getTime();
        const date = new Date(start_time);
        const block_delta = (this.max_blocks - this.min_blocks) / 100.0;
        const start_block = block_delta * this.start_block + this.min_blocks;
        const first_tx_block = block_delta * this.first_tx_block + this.min_blocks;
        const unreachable = this.props.contract.reachable_at_time(start_time / 1000, start_block, first_tx_time / 1000, first_tx_block);
        console.log(unreachable);
        this.props.contract.txn_models.forEach((m) => {
            m.setReachable(true);
        });
        unreachable.forEach((m) => {
            m.setReachable(false);
        });
        this.props.app.engine.repaintCanvas();
        this.setState({ date });
        this.props.app.forceUpdate();
    }
    render() {
        const changeHandler = this.changeHandler.bind(this);
        return (<Form>
            <h2>Block Time</h2>
            <Form.Group as={Row}>
                <Col sm={2}>
                    <h6>Start</h6>
                    <Form.Control defaultValue={this.min_blocks} type="number" onChange={(e: FormEvent) => changeHandler("min_blocks", e)}></Form.Control>
                </Col>
                <Col sm={8}>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>First Tx</Form.Label>
                        </Col>
                        <Col sm={10}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("first_tx_block", e)} />
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>Current Time</Form.Label>
                        </Col>
                        <Col sm={10}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("start_block", e)} />
                        </Col>
                    </Row>
                </Col>
                <Col sm={2}>
                    <h6>End</h6>
                    <Form.Control defaultValue={this.max_blocks} type="number" onChange={(e: FormEvent) => changeHandler("max_blocks", e)}></Form.Control>
                </Col>
            </Form.Group>
            <h2>Clock Time</h2>
            <Form.Group as={Row}>
                <Col sm={2}>
                    <h6>Start</h6>
                    <Form.Control defaultValue={this.min_time.toLocaleDateString("en-CA")} type="date" onChange={(e: FormEvent) => changeHandler("min_time", e)}></Form.Control>
                </Col>
                <Col sm={8}>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>First Tx</Form.Label>
                        </Col>
                        <Col sm={10}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("first_tx_time", e)}></Form.Control>
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>Current Time</Form.Label>
                        </Col>
                        <Col sm={10}>
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("start_time", e)}></Form.Control>
                        </Col>
                    </Row>
                </Col>
                <Col sm={2}>
                    <h6>End</h6>
                    <Form.Control defaultValue={this.max_time.toLocaleDateString("en-CA")} type="date" onChange={(e: FormEvent) => changeHandler("max_time", e)}></Form.Control>
                </Col>
            </Form.Group>
            <Form.Label>
                {this.state.date.toString()}
            </Form.Label>
        </Form>);
    }
}
