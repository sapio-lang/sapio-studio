import { CanvasWidget } from '@projectstorm/react-canvas-core';
import createEngine, { DiagramModel } from '@projectstorm/react-diagrams';
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import Col from 'react-bootstrap/Col';
import Collapse from 'react-bootstrap/Collapse';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import './App.css';
import { AppNavbar } from "./AppNavbar";
import { BitcoinNodeManager, update_broadcastable} from './BitcoinNode';
import { CompilerServer } from "./Compiler/ContractCompilerServer";
import { ContractBase, ContractModel } from './ContractManager';
import { TransactionNodeFactory } from './DiagramComponents/TransactionNode/TransactionNodeFactory';
import { DemoCanvasWidget } from './DemoCanvasWidget.tsx';
import { SpendLinkFactory } from "./DiagramComponents/SpendLink/SpendLinkFactory";
import { UTXONodeFactory } from './DiagramComponents/UTXONode/UTXONodeFactory';
import { EntityViewer } from './EntityViewer';





class ModelManager {
    constructor(model) {
        this.model = model;
    }
    load(contract) {
        this.model.addAll(...contract.txn_models);
        this.model.addAll(...contract.utxo_models);
    }
    unload(contract) {
        contract.txn_models.forEach((m) => m.remove(this.model))
    }
}

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.state.entity = {type:null};
        this.state.details = false;
        this.state.dynamic_forms = {};
        // engine is the processor for graphs, we need to load all our custom factories here
        this.engine = createEngine();
        this.engine.getNodeFactories().registerFactory(new UTXONodeFactory());
        this.engine.getNodeFactories().registerFactory(new TransactionNodeFactory());
        this.engine.getLinkFactories().registerFactory(new SpendLinkFactory());
        // model is the system of nodes
        this.model = new DiagramModel();
        this.model.setGridSize(50);
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
        this.state.current_contract = new ContractBase();
        this.form = {};
        this.state.modal_create = false;
        this.state.modal_view = false;
        /* Bitcoin Node State */
        this.bitcoin_node_manager = null;


        /* Socket Functionality */
        this.cm = new CompilerServer(null, this);
    };


    load_new_model(data) {
        let contract = new ContractModel(this.update_viewer.bind(this), data);
        update_broadcastable(contract, new Set());
        this.model_manager.unload(this.state.current_contract);
        this.model_manager.load(contract)
        this.setState({ current_contract: contract, model_number: this.model_number++ });
        this.forceUpdate();
    }

    update_viewer(data) {
        if (data.isSelected === false || data.entity === null) {
            this.setState({ details: false });
        } else if (data.entity) {
            this.setState({ entity: data.entity, details: true });
        }
    }

    hide_details() {
        this.setState({ details: false });
    }

    render() {

        return (
            <div className="App">
                <BitcoinNodeManager current_contract={this.state.current_contract} app={this} ref={(bnm) => this.bitcoin_node_manager = bnm}/>

                <Container fluid>
                    <AppNavbar
                        dynamic_forms={this.state.dynamic_forms}
                        load_new_model={(x) => this.load_new_model(x)}
                        compiler={this.cm} />
                    <Row>
                        <Col xs={this.state.details ? 6 : 12}
                            sm={this.state.details ? 7 : 12}
                            md={this.state.details ? 8 : 12}
                            lg={this.state.details ? 9 : 12}
                            xl={this.state.details ? 10 : 12}>
                            <DemoCanvasWidget engine={this.engine} model={this.model}
                                model_number={this.state.model_number}>
                                <CanvasWidget engine={this.engine} key={"main"} model={this.model} />
                            </DemoCanvasWidget>
                        </Col>
                        <Collapse in={this.state.details}>
                            <Col xs={6} sm={5} md={4} lg={3} xl={2}>
                                <EntityViewer
                                entity = {this.state.entity}
                                broadcast = {(x) => this.bitcoin_node_manager.broadcast(x)}
                                hide_details = {() => this.hide_details()}
                                current_contract = {this.state.current_contract}
                                update_viewer = {this.update_viewer.bind(this)}
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

