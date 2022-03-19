import { Collapse, Grid, Paper, Typography } from '@mui/material';
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
import './App.css';
import {
    create_contract_of_type,
    load_new_model,
    selectContract,
    selectShowing,
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
import {
    load_settings,
    poll_settings,
    SettingsStateType,
} from './Settings/SettingsSlice';
import { TXIDAndWTXIDMap } from './util';
import { AppNavbar } from './UX/AppNavbar';
import { set_continuations } from './UX/ContractCreator/ContractCreatorSlice';
import { CreateContractModal } from './UX/ContractCreator/CreateContractModal';
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
import { Modals } from './UX/Modals';
import { Settings } from './UX/Settings/Settings';
import { Wallet } from './Wallet/Wallet';

export type SelectedEvent = BaseEntityEvent<BaseModel<BaseModelGenerics>> & {
    isSelected: boolean;
};

function jump_to_entity(
    model: DiagramModel,
    engine: DiagramEngine,
    entity: TransactionModel | UTXOModel | null
) {
    if (entity === null) return;
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
    const contract = React.useRef<[ContractModel, number] | null>(null);
    const engine: DiagramEngine = createEngine();
    const model = React.useRef(new DiagramModel());

    // TODO: This should go somewhere else :(
    React.useEffect(() => {
        return window.electron.register('load_contract', (data: string) => {
            dispatch(load_new_model(JSON.parse(data)));
        });
    });
    React.useEffect(() => {
        setTimeout(() => {
            poll_settings(dispatch);
        }, 10);
    });

    engine.getNodeFactories().registerFactory(new UTXONodeFactory() as any);
    engine
        .getNodeFactories()
        .registerFactory(new TransactionNodeFactory() as any);
    engine.getLinkFactories().registerFactory(new SpendLinkFactory() as any);
    // model is the system of nodes
    model.current.setGridSize(1);
    model.current.setLocked(true);
    const model_manager = React.useRef(new ModelManager(model.current));
    engine.setModel(model.current);
    const load_new_contract = (data: Data | null, counter: number) => {
        if (contract.current !== null) {
            if (contract.current[1] === counter) {
                return contract.current[0];
            }
        }
        const new_contract = new ContractModel(data ?? { program: {} });
        update_broadcastable(new_contract, new Set());
        if (contract.current) model_manager.current.unload(contract.current[0]);
        contract.current = [new_contract, counter];
        model_manager.current.load(new_contract);
        dispatch(set_continuations(new_contract.continuations));
        return new_contract;
    };
    return (
        <AppInner
            engine={engine}
            model={model.current}
            load_new_contract={load_new_contract}
        ></AppInner>
    );
}
function AppInner(props: {
    engine: DiagramEngine;
    model: DiagramModel;
    load_new_contract: (data: Data | null, counter: number) => ContractModel;
}) {
    const bitcoin_node_bar = useSelector(selectStatusBar);
    const { engine, model, load_new_contract } = props;
    const entity_id: EntityType = useSelector(selectEntityToView);

    const show = useSelector(selectShouldViewEntity);
    const details = entity_id[0] !== 'NULL' && show;

    const [timing_simulator_enabled, set_timing_simulator_enabled] =
        React.useState(false);
    // engine is the processor for graphs, we need to load all our custom factories here

    const [contract_data, counter] = useSelector(selectContract);
    // keep the same contract model around as long as we can...
    const current_contract = load_new_contract(contract_data, counter);

    const is_showing = useSelector(selectShowing);

    React.useEffect(() => {
        if (entity_id[0] === 'TXN')
            jump_to_entity(
                model,
                engine,
                TXIDAndWTXIDMap.get_by_txid_s(
                    current_contract.txid_map,
                    entity_id[1]
                ) ?? null
            );
        else if (entity_id[0] === 'UTXO')
            jump_to_entity(
                model,
                engine,
                TXIDAndWTXIDMap.get_by_txid_s(
                    current_contract.txid_map,
                    entity_id[1].hash
                )?.utxo_models[entity_id[1].nIn] ?? null
            );
    }, [entity_id]);
    React.useEffect(() => {
        if (is_showing !== 'ContractCreator') return;
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
    const bitcoin_node_manager = React.useRef(
        new BitcoinNodeManager({
            model: model,
            current_contract: current_contract,
        })
    );

    React.useEffect(() => {
        return () => {
            bitcoin_node_manager.current.destroy();
        };
    });

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
    let showing = null;
    switch (is_showing) {
        case 'Settings':
            showing = (
                <Paper className="settings-container" square={true}>
                    <Settings></Settings>
                </Paper>
            );
            break;
        case 'Wallet':
            showing = (
                <Paper className="wallet-container" square={true}>
                    <Wallet
                        bitcoin_node_manager={bitcoin_node_manager.current}
                    ></Wallet>
                </Paper>
            );
            break;
        case 'ContractCreator':
            showing = <CreateContractModal />;
            break;
        case 'ContractViewer':
            showing = (
                <>
                    <div className="main-container">
                        <DemoCanvasWidget
                            engine={engine}
                            model={model}
                            background={theme.palette.background.paper}
                            color={theme.palette.divider}
                        >
                            <CanvasWidget engine={engine as any} key={'main'} />
                        </DemoCanvasWidget>
                    </div>
                    <Collapse in={details}>
                        <CurrentlyViewedEntity
                            current_contract={current_contract}
                        />
                    </Collapse>
                    <div className="area-overlays">
                        <Collapse in={timing_simulator_enabled}>
                            <SimulationController
                                contract={current_contract}
                                engine={engine}
                                hide={() => set_timing_simulator_enabled(false)}
                            />
                        </Collapse>
                    </div>
                </>
            );
            break;
    }
    console.log(showing);
    return (
        <ThemeProvider theme={theme}>
            <div className="App">
                <div className="App-area">
                    <div className="area-nav">
                        <AppNavbar
                            relayout={() => {
                                dag.redistribute(props.model);
                                engine.repaintCanvas();
                                setTimeout(() => engine.zoomToFit(), 0);
                            }}
                            bitcoin_node_manager={bitcoin_node_manager.current}
                            contract={current_contract}
                            toggle_timing_simulator={() =>
                                set_timing_simulator_enabled(
                                    !timing_simulator_enabled
                                )
                            }
                        />
                    </div>
                    <div className="area-inner">{showing}</div>
                </div>

                <Collapse in={bitcoin_node_bar}>
                    <div>
                        <BitcoinStatusBar
                            api={bitcoin_node_manager.current}
                        ></BitcoinStatusBar>
                    </div>
                </Collapse>
            </div>
            <Modals
                bitcoin_node_manager={bitcoin_node_manager.current}
                contract={current_contract}
            />
        </ThemeProvider>
    );
}

export default App;
