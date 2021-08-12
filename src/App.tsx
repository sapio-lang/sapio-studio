import {
    BaseEntityEvent,
    BaseModel,
    BaseModelGenerics,
    CanvasWidget,
} from '@projectstorm/react-canvas-core';
import createEngine, {
    DiagramEngine,
    DiagramModel,
    LinkModel,
} from '@projectstorm/react-diagrams';
import { Transaction } from 'bitcoinjs-lib';
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import './App.css';
import { CompilerServer } from './Compiler/ContractCompilerServer';
import { BitcoinNodeManager, update_broadcastable } from './Data/BitcoinNode';
import { ContractModel, Data, timing_cache } from './Data/ContractManager';
import { TransactionModel, PhantomTransactionModel } from './Data/Transaction';
import { UTXOModel } from './Data/UTXO';
import { SpendPortModel } from './UX/Diagram/DiagramComponents/SpendLink/SpendLink';
import { SpendLinkFactory } from './UX/Diagram/DiagramComponents/SpendLink/SpendLinkFactory';
import { TransactionNodeFactory } from './UX/Diagram/DiagramComponents/TransactionNode/TransactionNodeFactory';
import { UTXONodeFactory } from './UX/Diagram/DiagramComponents/UTXONode/UTXONodeFactory';
import { SimulationController } from './Simulation';
import { AppNavbar } from './UX/AppNavbar';
import { DemoCanvasWidget } from './UX/Diagram/DemoCanvasWidget';
import { EmptyViewer, EntityViewerModal, Viewer } from './UX/Entity/EntityViewer';
import Collapse from 'react-bootstrap/Collapse';
import './Glyphs.css';
import { TXID } from './util';


declare global {
    interface Window {
        electron: any;
    }
}
class ModelManager {
    model: DiagramModel;
    constructor(model: DiagramModel) {
        this.model = model;
    }
    load(contract: ContractModel) {
        this.model.addAll(
            ...contract.txn_models.filter(
                (v) => !(v instanceof PhantomTransactionModel)
            )
        );
        this.model.addAll(...contract.utxo_models);
        const utxo_links: LinkModel[] = contract.utxo_models
            .map((m: UTXOModel) => m.getOutPorts())
            .flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])
            )
            .flat(1);
        this.model.addAll(...utxo_links);
        const tx_links: LinkModel[] = contract.txn_models
            .filter((v) => !(v instanceof PhantomTransactionModel))
            .map((m: TransactionModel) => m.getOutPorts())
            .flat(1)
            .map((p: SpendPortModel) =>
                Object.entries(p.getLinks()).map((v) => v[1])
            )
            .flat(1);

        this.model.addAll(...tx_links);
    }
    unload(contract: ContractModel) {
        contract.txn_models.forEach((m) => m.remove_from_model(this.model));
        timing_cache.cache.clear();
    }
}

export type SelectedEvent = BaseEntityEvent<BaseModel<BaseModelGenerics>> & {
    isSelected: boolean;
};

interface AppState {
    entity: Viewer;
    details: boolean;
    dynamic_forms: any;
    current_contract: ContractModel;
    modal_create: boolean;
    modal_view: boolean;
    model_number: number;
    timing_simulator_enabled: boolean;
}
export class App extends React.Component<any, AppState> {
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
            timing_simulator_enabled: false,
        };
        // engine is the processor for graphs, we need to load all our custom factories here
        this.engine = createEngine();
        this.engine
            .getNodeFactories()
            .registerFactory(new UTXONodeFactory() as any);
        this.engine
            .getNodeFactories()
            .registerFactory(new TransactionNodeFactory() as any);
        this.engine
            .getLinkFactories()
            .registerFactory(new SpendLinkFactory() as any);
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
        this.bitcoin_node_manager = new BitcoinNodeManager({
            app: this,
            current_contract: this.state.current_contract,
        });

        /* Socket Functionality */
        this.cm = new CompilerServer(null, this);

        console.log('APP', this);
    }

    load_new_model(data: Data) {
        let contract = new ContractModel(this.update_viewer.bind(this), data);
        update_broadcastable(contract, new Set());
        this.model_manager.unload(this.state.current_contract);
        this.model_manager.load(contract);
        this.setState(
            { current_contract: contract, model_number: this.model_number++ },
            () => setTimeout(() => this.forceUpdate(), 100)
        );
    }

    update_viewer(data: SelectedEvent) {
        if (data.isSelected === false || data.entity === null) return;
        if (
            !(
                data.entity instanceof UTXOModel ||
                data.entity instanceof TransactionModel
            )
        )
            return;

        this.model.setZoomLevel(100);
        const { clientHeight, clientWidth } = this.engine.getCanvas();
        const { left, top } = this.engine.getCanvas().getBoundingClientRect();
        let { x, y } = data.entity.getPosition();
        x += data.entity.width / 2;
        y += data.entity.height;
        const zoomf = this.model.getZoomLevel() / 100;
        const x_coord = (left + clientWidth / 3 - x) * zoomf;
        const y_coord = (top + clientHeight / 2 - y) * zoomf;
        this.model.setOffset(x_coord, y_coord);
        this.setState({ entity: data.entity, details: true });
    }

    hide_details() {
        this.setState({ details: false });
    }

    render() {
        const entity = !this.state.details ? null : (
            <EntityViewerModal
                entity={this.state.entity}
                broadcast={(x: Transaction) =>
                    this.bitcoin_node_manager.broadcast(x)
                }
                fund_out={(x: Transaction) =>
                    this.bitcoin_node_manager.fund_out(x)
                }
                fetch_utxo={(t: TXID, n: number) =>
                    this.bitcoin_node_manager.fetch_utxo(t, n)
                }
                hide_details={() => this.hide_details()}
                current_contract={this.state.current_contract}
                load_new_contract={(x: Data) => this.load_new_model(x)}
            />
        );
        return (
            <div className="App">
                <BitcoinNodeManager
                    current_contract={this.state.current_contract}
                    app={this}
                    ref={(bnm) =>
                        (this.bitcoin_node_manager =
                            bnm || this.bitcoin_node_manager)
                    }
                />
                <div className="area">
                    <div>
                        <AppNavbar
                            dynamic_forms={this.state.dynamic_forms}
                            load_new_model={(x: Data) => this.load_new_model(x)}
                            compiler={this.cm}
                            contract={this.state.current_contract}
                            toggle_timing_simulator={(b: boolean) =>
                                this.setState({ timing_simulator_enabled: b })
                            }
                        />

                        <Collapse in={this.state.timing_simulator_enabled}>
                            <div>
                                <SimulationController
                                    contract={this.state.current_contract}
                                    app={this}
                                />
                            </div>
                        </Collapse>
                    </div>
                    <div className="area-inner">
                        <div className="main-container">
                            <DemoCanvasWidget
                                engine={this.engine}
                                model={this.model}
                                model_number={this.state.model_number}
                            >
                                <CanvasWidget
                                    engine={this.engine as any}
                                    key={'main'}
                                />
                            </DemoCanvasWidget>
                        </div>
                        <div>{entity}</div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
