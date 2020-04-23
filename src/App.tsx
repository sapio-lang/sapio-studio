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
                                .map((p: SpendPortModel)=>
                                    Object.entries(p.getLinks()).map((v)=> v[1])).flat(1);
        this.model.addAll(...utxo_links);
        const tx_links : LinkModel[] = contract.txn_models
                                .map((m: TransactionModel) => m.getOutPorts()).flat(1)
                                .map((p: SpendPortModel)=>
                                    Object.entries(p.getLinks()).map((v)=> v[1])).flat(1);

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
                    <SimulationController contract={this.state.current_contract}
                    app={this}/>
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
                </Container>
            </div>
        );
    }
}

type Field = "time" | "min_time" | "max_time" | "blocks"| "min_blocks" | "max_blocks";
class SimulationController extends React.Component<{contract:ContractModel, app:App}> {
    time: number;
    min_time: number;
    max_time: number;
    blocks: number;
    min_blocks: number;
    max_blocks: number;
    timeout: NodeJS.Timeout;
    constructor(props: any) {
        super(props);
        this.time = 50;
        this.min_time = this.time -365*24*60*60;
        this.max_time = this.time + 365*24*60*60;
        this.blocks = 50;
        this.min_blocks = 0;
        this.max_blocks = 1_000_000_000;
        this.timeout = setTimeout(() => null, 0);
    }
    changeHandler(from:Field, e: FormEvent) {
        console.log(this);
        const input = e.currentTarget as HTMLInputElement;
        switch (from) {
            case "min_time":
                this.min_time = input.valueAsNumber;
                break;
            case "time":
                this.time = input.valueAsNumber;
                break;
            case "max_time":
                this.max_time = input.valueAsNumber;
                break;
            case "min_blocks":
                this.min_blocks = input.valueAsNumber;
                break;
            case "blocks":
                this.blocks = input.valueAsNumber;
                break;
            case "max_blocks":
                this.max_blocks = input.valueAsNumber;
                break;
        }
        console.log(this.time, this.min_time, this.max_time, this.blocks, this.min_blocks, this.max_blocks);
        // wait a second from last update
        clearTimeout(this.timeout);
        this.timeout = setTimeout(()=> this.delayedUpdate(), 1000);
    }
    delayedUpdate() {
        const time = (this.max_time - this.min_time)/100.0*this.time + this.min_time;
        const blocks = (this.max_blocks - this.min_blocks)/100.0*this.blocks + this.min_blocks;
        const unreachable = this.props.contract.reachable_at_time(time, blocks);
        this.props.contract.txn_models.forEach((m) => {
            m.setReachable(true);
        });
        unreachable.forEach((m) => {
            m.setReachable(false);
        });
        this.props.app.engine.repaintCanvas();
        this.props.app.forceUpdate();
        console.log("FIRE", unreachable);
    }
    render() {
        const changeHandler = this.changeHandler.bind(this);
        return (<Form>
            <Form.Group>
                <Form.Control type="number" onChange={(e: FormEvent) => changeHandler("min_blocks", e)}></Form.Control>
                <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("blocks", e)}></Form.Control>
                <Form.Control type="number" onChange={(e: FormEvent) => changeHandler("max_blocks", e)}></Form.Control>
            </Form.Group>
            <Form.Group>
                <Form.Control type="number" onChange={(e: FormEvent) => changeHandler("min_time", e)}></Form.Control>
                <Form.Control type="range" onChange={(e: FormEvent) => changeHandler("time", e)}></Form.Control>
                <Form.Control type="number" onChange={(e: FormEvent) => changeHandler("max_time", e)}></Form.Control>
            </Form.Group>
        </Form>);
    }
}
export default App;

