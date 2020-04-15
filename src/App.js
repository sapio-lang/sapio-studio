import React from 'react';
import './App.css';

import createEngine, { DiagramModel,
} from '@projectstorm/react-diagrams';
import { AbstractModelFactory, CanvasWidget } from '@projectstorm/react-canvas-core';

import { DemoCanvasWidget } from './DemoCanvasWidget.tsx';
import {ContractBase} from './ContractManager';
import {UTXOComponent} from './UTXO';
import {TransactionComponent} from './Transaction';
import {CustomNodeFactory} from './custom_node/CustomNodeFactory';
import {hash_to_hex} from './Hex';

import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Collapse from 'react-bootstrap/Collapse';
import {SpendLinkFactory} from "./SpendLink"
import {UTXONodeFactory} from './utxo_node/UTXONodeFactory';
import { VaultManager } from './VaultManager';
import { AppNavbar } from "./AppNavbar";
import {CompilerServer} from "./Compiler/ContractCompilerServer";


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
        this.engine.setModel(this.model);

        this.vault = new ContractBase();
        this.state.vault = this.vault;
        this.form = {};
        this.state.modal_create = false;
        this.state.modal_view = false;
        this.vaultman = new VaultManager(this);
        this.vaultman.create_vault({amount:1, steps:10, maturity:5, step_period:1})
        this.redistributeFn = () => null;


        /* Socket Functionality */
        this.cm = new CompilerServer(null, this);
    };



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
    redistribute() {
        this.redistributeFn();
    }
    setRedistribute(fn) {
        this.redistributeFn = fn;
    }

    render() {
        const transaction_component = this.state.entity.type === "txn" ?
                                <TransactionComponent entity={this.state.entity}
                                    hide_details={this.hide_details.bind(this)}
                                    update={this.update_viewer.bind(this)}
                                    find_tx_model={(txid, n) => {
                                        const idx = this.state.vault.txid_map.get(hash_to_hex(txid));
                                        if (idx === undefined) return null;
                                        return this.state.vault.txn_models[idx].utxo_models[n];
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
                    <AppNavbar vaultman={this.vaultman} dynamic_forms={this.state.dynamic_forms}/>
                    <Row>
                        <Col xs={this.state.details? 6: 12}
                            sm={this.state.details? 7: 12}
                            md={this.state.details? 8: 12}
                            lg={this.state.details? 9: 12}
                            xl={this.state.details? 10: 12}>
                            <DemoCanvasWidget engine={this.engine} model={this.model} registerChange={this.setRedistribute.bind(this)}>
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

