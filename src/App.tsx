import { Collapse } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
    BaseEntityEvent,
    BaseModel,
    BaseModelGenerics,
    CanvasWidget,
} from '@projectstorm/react-canvas-core';
import createEngine, {
    DagreEngine,
    DiagramEngine,
    DiagramModel,
} from '@projectstorm/react-diagrams';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dispatch } from 'redux';
import './App.css';
import {
    create_contract_of_type,
    load_new_model,
    selectContract,
    selectStatusBar,
} from './AppSlice';
import { BitcoinNodeManager, update_broadcastable } from './Data/BitcoinNode';
import { BitcoinStatusBar } from './Data/BitcoinStatusBar';
import { ContractModel, Data } from './Data/ContractManager';
import { ModelManager } from './Data/ModelManager';
import { SimulationController } from './Data/Simulation';
import { TransactionModel } from './Data/Transaction';
import { UTXOModel } from './Data/UTXO';
import './Glyphs.css';
import { TXIDAndWTXIDMap } from './util';
import { AppNavbar } from './UX/AppNavbar';
import { DemoCanvasWidget } from './UX/Diagram/DemoCanvasWidget';
import { SpendLinkFactory } from './UX/Diagram/DiagramComponents/SpendLink/SpendLinkFactory';
import { TransactionNodeFactory } from './UX/Diagram/DiagramComponents/TransactionNode/TransactionNodeFactory';
import { UTXONodeFactory } from './UX/Diagram/DiagramComponents/UTXONode/UTXONodeFactory';
import {
    EntityType,
    selectEntityToView,
    selectShouldViewEntity,
} from './UX/Entity/EntitySlice';
import { CurrentlyViewedEntity } from './UX/Entity/EntityViewer';

export type SelectedEvent = BaseEntityEvent<BaseModel<BaseModelGenerics>> & {
    isSelected: boolean;
};

function jump_to_entity(
    model: DiagramModel,
    engine: DiagramEngine,
    entity: TransactionModel | UTXOModel
) {
    const canvas = engine.getCanvas();
    // Bug, sometimes no fields
    if (canvas === undefined) {
        return;
    }
    model.setZoomLevel(100);
    const { clientHeight, clientWidth } = canvas;
    const { left, top } = canvas.getBoundingClientRect();
    let { x, y } = entity.getPosition();
    x += entity.width / 2;
    y += entity.height;
    const zoomf = model.getZoomLevel() / 100;
    const x_coord = (left + clientWidth / 3 - x) * zoomf;
    const y_coord = (top + clientHeight / 2 - y) * zoomf;
    model.setOffset(x_coord, y_coord);
}

const dag = new DagreEngine({
    graph: {
        rankdir: 'TB',
        align: 'DL',
        ranker: 'tight-tree',
        marginx: 25,
        marginy: 25,
    },
    includeLinks: false,
});
function App() {
    const dispatch = useDispatch();

    // TODO: This should go somewhere else :(
    React.useEffect(() => {
        return window.electron.register('load_contract', (data: string) => {
            dispatch(load_new_model(JSON.parse(data)));
        });
    });

    React.useEffect(() => {
        window.electron.register(
            'create_contract_from_cache',
            async ([which, args]: [string, string]) => {
                dispatch(create_contract_of_type(which, args));
            }
        );
    });
    const engine: DiagramEngine = createEngine();
    engine.getNodeFactories().registerFactory(new UTXONodeFactory() as any);
    engine
        .getNodeFactories()
        .registerFactory(new TransactionNodeFactory() as any);
    engine.getLinkFactories().registerFactory(new SpendLinkFactory() as any);
    // model is the system of nodes
    const model = new DiagramModel();
    model.setGridSize(50);
    model.setLocked(true);
    const model_manager = new ModelManager(model);
    engine.setModel(model);
    // TODO: multi-component safe memo?
    let memo: [ContractModel, number] | null = null;
    const load_new_contract = (data: Data | null, counter: number) => {
        if (memo && data) {
            if (memo[1] === counter) {
                return memo[0];
            }
        }
        const new_contract = new ContractModel(data ?? { program: [] });
        update_broadcastable(new_contract, new Set());
        if (memo) model_manager.unload(memo[0]);
        memo = [new_contract, counter];
        model_manager.load(new_contract);
        return new_contract;
    };
    return (
        <AppInner
            engine={engine}
            model={model}
            model_manager={model_manager}
            load_new_contract={load_new_contract}
        ></AppInner>
    );
}
function AppInner(props: {
    engine: DiagramEngine;
    model: DiagramModel;
    model_manager: ModelManager;
    load_new_contract: (data: Data | null, counter: number) => ContractModel;
}) {
    const bitcoin_node_bar = useSelector(selectStatusBar);
    let { engine, model, model_manager, load_new_contract } = props;
    const entity_id: EntityType = useSelector(selectEntityToView);

    const show = useSelector(selectShouldViewEntity);
    const details = entity_id !== null && show;

    const [
        timing_simulator_enabled,
        set_timing_simulator_enabled,
    ] = React.useState(false);
    // engine is the processor for graphs, we need to load all our custom factories here

    const [contract_data, counter] = useSelector(selectContract);
    // keep the same contract model around as long as we can...
    const current_contract = load_new_contract(contract_data, counter);

    React.useEffect(() => {
        let entity: UTXOModel | TransactionModel | null = null;
        switch (entity_id[0]) {
            case 'TXN':
                entity =
                    TXIDAndWTXIDMap.get_by_txid_s(
                        current_contract.txid_map,
                        entity_id[1]
                    ) ?? null;
                break;
            case 'UTXO':
                entity =
                    TXIDAndWTXIDMap.get_by_txid_s(
                        current_contract.txid_map,
                        entity_id[1].hash
                    )?.utxo_models[entity_id[1].nIn] ?? null;
                break;
        }
        if (entity) jump_to_entity(model, engine, entity);
    }, [entity_id]);
    React.useEffect(() => {
        dag.redistribute(props.model);
        engine.repaintCanvas();
        setTimeout(() => engine.zoomToFit(), 0);
    }, [counter]);
    /* current_contract is the contract loaded into the
     * backend logic interface */
    /* state.current_contract is the contract loaded into the
     * ux
     * TODO: Can these be unified?
     */
    /* Bitcoin Node State */
    let bitcoin_node_manager = new BitcoinNodeManager({
        model: model,
        current_contract: current_contract,
    });
    const entityViewer = !details ? null : (
        <CurrentlyViewedEntity current_contract={current_contract} />
    );

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                    primary: {
                        main: '#90caf9',
                    },
                    secondary: {
                        main: '#9c27b0',
                    },
                },
            }),
        [prefersDarkMode]
    );
    return (
        <ThemeProvider theme={theme}>
            <div className="App">
                <BitcoinNodeManager
                    current_contract={current_contract}
                    model={model}
                    ref={(bnm) =>
                        (bitcoin_node_manager = bnm || bitcoin_node_manager)
                    }
                />
                <div className="area">
                    <div>
                        <AppNavbar
                            bitcoin_node_manager={bitcoin_node_manager}
                            contract={current_contract}
                            toggle_timing_simulator={() =>
                                set_timing_simulator_enabled(
                                    !timing_simulator_enabled
                                )
                            }
                        />
                    </div>
                    <div className="area-inner">
                        <div className="main-container">
                            <DemoCanvasWidget
                                engine={engine}
                                model={model}
                                background={theme.palette.background.paper}
                                color={theme.palette.divider}
                            >
                                <CanvasWidget
                                    engine={engine as any}
                                    key={'main'}
                                />
                            </DemoCanvasWidget>
                        </div>
                        <div>{entityViewer}</div>
                    </div>
                    <div className="area-overlays">
                        <Collapse in={timing_simulator_enabled}>
                            <SimulationController
                                contract={current_contract}
                                engine={engine}
                                hide={() => set_timing_simulator_enabled(false)}
                            />
                        </Collapse>
                        <Collapse in={bitcoin_node_bar}>
                            <div>
                                <BitcoinStatusBar
                                    api={bitcoin_node_manager}
                                ></BitcoinStatusBar>
                            </div>
                        </Collapse>
                    </div>
                </div>
            </div>
        </ThemeProvider>
    );
}

export default App;
