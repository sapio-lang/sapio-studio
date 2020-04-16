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
import { BitcoinNodeManager } from './BitcoinNode';
import { CompilerServer } from "./Compiler/ContractCompilerServer";
import { ContractBase, ContractModel } from './ContractManager';
import { CustomNodeFactory } from './custom_node/CustomNodeFactory';
import { DemoCanvasWidget } from './DemoCanvasWidget.tsx';
import { hash_to_hex } from './Hex';
import { SpendLinkFactory } from "./SpendLink/SpendLinkFactory";
import { TransactionComponent } from './Transaction';
import { UTXOComponent } from './UTXO';
import { UTXONodeFactory } from './utxo_node/UTXONodeFactory';





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
        this.state.entity = {type: null};
        this.state.details = false;
        this.state.dynamic_forms = {};
        this.engine = createEngine();
        this.engine.getNodeFactories().registerFactory(new UTXONodeFactory());
        this.engine.getNodeFactories().registerFactory(new CustomNodeFactory());
        this.engine.getLinkFactories().registerFactory(new SpendLinkFactory());
        this.model = new DiagramModel();
        this.model.setGridSize(50);
        this.model.setLocked(true);
        this.model_manager = new ModelManager(this.model);
        this.model_number = 0;
        this.engine.setModel(this.model);

        this.current_contract = new ContractBase();
        this.state.current_contract = this.current_contract;
        this.form = {};
        this.state.modal_create = false;
        this.state.modal_view = false;
        this.bitcoin_node_manager = new BitcoinNodeManager(this);


        /* Socket Functionality */
        this.cm = new CompilerServer(null, this);
    };


    load_new_model(data) {
        let contract = new ContractModel(this.update_viewer.bind(this), data);
        this.model_manager.unload(this.current_contract);
        this.model_manager.load(contract)
        this.current_contract = contract;
        this.setState({ contract });
        this.setState({model_number:this.model_number});
        this.model_number += 1;
        this.bitcoin_node_manager.update_broadcastable();
        this.forceUpdate(() => {
        });
        // TODO: Fix this! Sketchy...
    }

    update_viewer (data) {
        if (data.isSelected === false || data.entity === null) {
            this.setState({details:false});
        } else if (data.entity) {
            this.setState({entity:data.entity, details:true});
        }
    }

    hide_details() {
        this.setState({details: false});
    }

    render() {
        const transaction_component = this.state.entity.type === "txn" ?
                                <TransactionComponent entity={this.state.entity}
                                    hide_details={this.hide_details.bind(this)}
                                    update={this.update_viewer.bind(this)}
                                    find_tx_model={(txid, n) => {
                                        const idx = this.state.current_contract.txid_map.get(hash_to_hex(txid));
                                        if (idx === undefined) return null;
                                        return this.state.current_contract.txn_models[idx].utxo_models[n];
                                    }
                                    }
                                />
            :null;
        const utxo_component = this.state.entity.type === "utxo" ?
                                <UTXOComponent entity={this.state.entity}
                                    hide_details={this.hide_details.bind(this)}
                                    update={this.update_viewer.bind(this)}
                                />
            :null;

        return (
            <div className="App">
                <Container fluid>
                    <AppNavbar
                        dynamic_forms={this.state.dynamic_forms}
                        load_new_model={(x) => this.load_new_model(x)}
                        compiler={this.cm} />
                    <Row>
                        <Col xs={this.state.details? 6: 12}
                            sm={this.state.details? 7: 12}
                            md={this.state.details? 8: 12}
                            lg={this.state.details? 9: 12}
                            xl={this.state.details? 10: 12}>
                            <DemoCanvasWidget engine={this.engine} model={this.model} 
                                model_number={this.state.model_number}>
                                <CanvasWidget engine={this.engine} key={"main"} model={this.model}/>
                            </DemoCanvasWidget>
                        </Col>
                        <Collapse in={this.state.details}>
                            <Col  xs={6} sm={5} md={4} lg={3} xl={2}>
                                {transaction_component}
                                {utxo_component}
                            </Col>
                        </Collapse>
                    </Row>
                </Container>
            </div>
        );
    }
}

export default App;

