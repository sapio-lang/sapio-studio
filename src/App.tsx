import { CanvasWidget, CanvasEngine, BaseEntityEvent, BaseModel, BaseModelGenerics } from '@projectstorm/react-canvas-core';
import createEngine, { DiagramModel, DiagramEngine, LinkModel } from '@projectstorm/react-diagrams';
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Collapse from 'react-bootstrap/Collapse';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import './App.css';
import { AppNavbar } from "./UX/AppNavbar";
import { BitcoinNodeManager, update_broadcastable } from './Data/BitcoinNode';
import { CompilerServer } from "./Compiler/ContractCompilerServer";
import { ContractBase, ContractModel, Data } from './Data/ContractManager';
import { TransactionNodeFactory } from './DiagramComponents/TransactionNode/TransactionNodeFactory';
import { DemoCanvasWidget } from './UX/DemoCanvasWidget';
import { SpendLinkFactory } from "./DiagramComponents/SpendLink/SpendLinkFactory";
import { UTXONodeFactory } from './DiagramComponents/UTXONode/UTXONodeFactory';
import { EntityViewerModal, Viewer, EmptyViewer } from './UX/EntityViewer';
import { UTXOModel } from './Data/UTXO';
import { Transaction } from 'bitcoinjs-lib';
import { TransactionModel } from './Data/Transaction';
import { UTXONodeModelGenerics } from './DiagramComponents/UTXONode/UTXONodeModel';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import _ from 'lodash';
import { OutputPortModel, OutputLinkModel } from './DiagramComponents/OutputLink';
import { SpendPortModel } from './DiagramComponents/SpendLink/SpendLink';





class ModelManager {
    model: DiagramModel;
    constructor(model: DiagramModel) {
        this.model = model;
    }
    load(contract: ContractModel) {
        this.model.addAll(...contract.txn_models);
        this.model.addAll(...contract.utxo_models);
        const utxo_links: LinkModel[] = contract.utxo_models
            .map((m: UTXOModel) => m.getOutPorts()).flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])).flat(1);
        this.model.addAll(...utxo_links);
        const tx_links: LinkModel[] = contract.txn_models
            .map((m: TransactionModel) => m.getOutPorts()).flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])).flat(1);

        this.model.addAll(...tx_links);
    }
    unload(contract: ContractModel) {
        contract.txn_models.forEach((m) => m.remove_from_model(this.model));
    }
}

export type SelectedEvent = BaseEntityEvent<BaseModel<BaseModelGenerics>> & { isSelected: boolean; };

interface AppState {
    entity: Viewer
    details: boolean;
    dynamic_forms: any;
    current_contract: ContractModel;
    modal_create: boolean;
    modal_view: boolean;
    model_number: number;
}
class App extends React.Component<any, AppState> {
    engine: DiagramEngine;
    model: DiagramModel;
    model_manager: ModelManager;
    model_number: number;
    cm: CompilerServer;
    form: any;
    bitcoin_node_manager: BitcoinNodeManager;

    constructor(props: any) {
        super(props);
        this.state = {
            entity: new EmptyViewer(),
            details: false,
            dynamic_forms: null,
            current_contract: new ContractModel(),
            modal_create: false,
            modal_view: false,
            model_number: -1,
        };
        // engine is the processor for graphs, we need to load all our custom factories here
        this.engine = createEngine();
        this.engine.getNodeFactories().registerFactory(new UTXONodeFactory() as any);
        this.engine.getNodeFactories().registerFactory(new TransactionNodeFactory() as any);
        this.engine.getLinkFactories().registerFactory(new SpendLinkFactory() as any);
        // model is the system of nodes
        this.model = new DiagramModel();
        this.model.setGridSize(50);
        console.log(this.model);
        this.model.setLocked(true);
        this.model_manager = new ModelManager(this.model);
        this.model_number = 0;
        this.engine.setModel(this.model);

        /* current_contract is the contract loaded into the
         * backend logic interface */
        /* state.current_contract is the contract loaded into the
         * ux
         * TODO: Can these be unified?
         */
        this.form = {};
        /* Bitcoin Node State */
        this.bitcoin_node_manager = new BitcoinNodeManager({ app: this, current_contract: this.state.current_contract });


        /* Socket Functionality */
        this.cm = new CompilerServer(null, this);


        console.log("APP", this);
    };


    load_new_model(data: Data) {
        let contract = new ContractModel(this.update_viewer.bind(this), data);
        update_broadcastable(contract, new Set());
        this.model_manager.unload(this.state.current_contract);
        this.model_manager.load(contract)
        this.setState({ current_contract: contract, model_number: this.model_number++ },
            () => setTimeout(() => this.forceUpdate(), 100));
    }


    update_viewer(data: SelectedEvent) {
        if (data.isSelected === false || data.entity === null) return;
        if (!(data.entity instanceof UTXOModel || data.entity instanceof TransactionModel)) return;

        this.model.setZoomLevel(100);
        const { clientHeight, clientWidth } = this.engine.getCanvas();
        const { left, top } = this.engine.getCanvas().getBoundingClientRect();
        let { x, y } = data.entity.getPosition();
        x += data.entity.width / 2;
        y += data.entity.height;
        const zoomf = this.model.getZoomLevel() / 100;
        const x_coord = (left + clientWidth / 3 - x) * zoomf;
        const y_coord = (top + clientHeight / 2 - y) * zoomf;
        this.model.setOffset(x_coord, y_coord)
        this.setState({ entity: data.entity, details: true });
    }

    hide_details() {
        this.setState({ details: false });
    }

    render() {

        return (
            <div className="App">
                <BitcoinNodeManager current_contract={this.state.current_contract} app={this} ref={(bnm) => this.bitcoin_node_manager = bnm || this.bitcoin_node_manager} />

                <Container fluid>
                    <AppNavbar
                        dynamic_forms={this.state.dynamic_forms}
                        load_new_model={(x: Data) => this.load_new_model(x)}
                        compiler={this.cm} />
                    <Row>
                        <Col md={12} >
                            <DemoCanvasWidget engine={this.engine} model={this.model}
                                model_number={this.state.model_number}>
                                <CanvasWidget engine={this.engine as any} key={"main"} />
                            </DemoCanvasWidget>
                        </Col>
                        <EntityViewerModal
                            show={this.state.details}
                            entity={this.state.entity}
                            broadcast={(x: Transaction) => this.bitcoin_node_manager.broadcast(x)}
                            hide_details={() => this.hide_details()}
                            current_contract={this.state.current_contract}
                        />
                    </Row>
                    <SimulationController contract={this.state.current_contract}
                        app={this} />
                </Container>
            </div>
        );
    }
}

type Field = "start_time" | "first_tx_time" | "min_time" | "max_time" | "start_block" | "first_tx_block" | "min_blocks" | "max_blocks";
class SimulationController extends React.Component<{ contract: ContractModel, app: App }, {date:Date}> {
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
        this.min_blocks = (new Date().getFullYear() - 2008)*144*365 - 144*365/2;
        this.max_blocks = this.min_blocks + 144*(365);
        this.timeout = setTimeout(() => null, 0);
        this.state ={date: new Date()};
    }
    changeHandler(from: Field, e: FormEvent) {
        const input = e.currentTarget as HTMLInputElement;
        switch (from) {
            case "min_time":
                this.min_time = input.valueAsDate??this.min_time;
                break;
            case "first_tx_time":
                this.first_tx_time = input.valueAsNumber / 100.0;
                break;
            case "start_time":
                this.start_time = input.valueAsNumber / 100.0;
                break;
            case "max_time":
                this.max_time = input.valueAsDate??this.max_time;
                break;
            case "min_blocks":
                this.min_blocks = input.valueAsNumber;
                break;
            case "start_block":
                this.start_block = input.valueAsNumber/ 100.0;
                break;
            case "first_tx_block":
                this.first_tx_block = input.valueAsNumber/ 100.0;
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
        const time_delta = (this.max_time.getTime() - this.min_time.getTime())
        const start_time = this.start_time*time_delta + this.min_time.getTime();
        const first_tx_time = this.first_tx_time*time_delta + this.min_time.getTime();
        const date = new Date(start_time);
        const block_delta = (this.max_blocks - this.min_blocks) / 100.0;
        const start_block =  block_delta* this.start_block + this.min_blocks;
        const first_tx_block =  block_delta* this.first_tx_block + this.min_blocks;
        const unreachable = this.props.contract.reachable_at_time(start_time/1000, start_block, first_tx_time/1000, first_tx_block);
        console.log(unreachable);
        this.props.contract.txn_models.forEach((m) => {
            m.setReachable(true);
        });
        unreachable.forEach((m) => {
            m.setReachable(false);
        });
        this.props.app.engine.repaintCanvas();
        this.setState({date})
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
                            <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("first_tx_block", e)}/>
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={2}>
                            <Form.Label>Current Time</Form.Label>
                        </Col>
                        <Col sm={10}>
                            <Form.Control type="range" 
                            onChange={(e: FormEvent) => changeHandler("start_block", e)}/>
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
export default App;

