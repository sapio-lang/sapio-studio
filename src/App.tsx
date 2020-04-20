import { CanvasWidget, CanvasEngine } from '@projectstorm/react-canvas-core';
import createEngine, { DiagramModel, DiagramEngine, LinkModel } from '@projectstorm/react-diagrams';
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import Col from 'react-bootstrap/Col';
import Collapse from 'react-bootstrap/Collapse';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import './App.css';
import { AppNavbar } from "./AppNavbar";
import { BitcoinNodeManager, update_broadcastable } from './BitcoinNode';
import { CompilerServer } from "./Compiler/ContractCompilerServer";
import { ContractBase, ContractModel, Data } from './ContractManager';
import { TransactionNodeFactory } from './DiagramComponents/TransactionNode/TransactionNodeFactory';
import { DemoCanvasWidget } from './DemoCanvasWidget';
import { SpendLinkFactory } from "./DiagramComponents/SpendLink/SpendLinkFactory";
import { UTXONodeFactory } from './DiagramComponents/UTXONode/UTXONodeFactory';
import { EntityViewer, Viewer, EmptyViewer, UpdateMessage } from './EntityViewer';
import { UTXOModel } from './UTXO';
import { Transaction } from 'bitcoinjs-lib';
import { TransactionModel } from './Transaction';
import { UTXONodeModelGenerics } from './DiagramComponents/UTXONode/UTXONodeModel';





class ModelManager {
    model: DiagramModel;
    constructor(model: DiagramModel) {
        this.model = model;
    }
    load(contract: ContractModel) {
        this.model.addAll(...contract.txn_models);
        this.model.addAll(...contract.utxo_models);
        this.model.addAll(...(contract.link_models as unknown[] as LinkModel[]));
    }
    unload(contract: ContractModel) {
        contract.txn_models.forEach((m) => m.remove_from_model(this.model));
    }
}

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

    update_viewer(data: UpdateMessage) {
        if (data.isSelected === undefined) {
            data.isSelected = true;
        }
        if (data.isSelected === false || data.entity === null) {
            this.setState({ details: false });
        } else if (data.entity) {
            if (data.entity instanceof UTXOModel || data.entity instanceof TransactionModel) {
                this.model.setZoomLevel(100);
                const { clientHeight, clientWidth } = this.engine.getCanvas();
                const zoomf = this.model.getZoomLevel() / 100;
                const {left, top} = this.engine.getCanvas().getBoundingClientRect();

                const {x,y } = data.entity.getPosition();
                const x_coord = x + left -clientWidth/2;
                const y_coord = y + top - clientHeight/2;

                this.model.setOffset(-x_coord/zoomf, -y_coord/zoomf)
                this.setState({ entity: data.entity, details: true });
            }
        }
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
                        <Col xs={this.state.details ? 6 : 12}
                            sm={this.state.details ? 7 : 12}
                            md={this.state.details ? 8 : 12}
                            lg={this.state.details ? 9 : 12}
                            xl={this.state.details ? 10 : 12}>
                            <DemoCanvasWidget engine={this.engine} model={this.model}
                                model_number={this.state.model_number}>
                                <CanvasWidget engine={this.engine as any} key={"main"} />
                            </DemoCanvasWidget>
                        </Col>
                        <Collapse in={this.state.details}>
                            <Col xs={6} sm={5} md={4} lg={3} xl={2}>
                                <EntityViewer
                                    entity={this.state.entity}
                                    broadcast={(x: Transaction) => this.bitcoin_node_manager.broadcast(x)}
                                    hide_details={() => this.hide_details()}
                                    current_contract={this.state.current_contract}
                                    update_viewer={this.update_viewer.bind(this)}
                                />
                            </Col>
                        </Collapse>
                    </Row>
                </Container>
            </div>
        );
    }
}

export default App;

