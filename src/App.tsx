import { Collapse, Paper } from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
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
import { selectContract, selectShowing, selectStatusBar } from './AppSlice';
import { Data } from './common/preload_interface';
import { BitcoinNodeManager } from './Data/BitcoinNode';
import { BitcoinStatusBar } from './Data/BitcoinStatusBar';
import { ContractModel } from './Data/ContractManager';
import { ModelManager } from './Data/ModelManager';
import { SimulationController } from './Data/Simulation';
import { selectSimIsShowing, toggle_showing } from './Data/SimulationSlice';
import { TransactionModel } from './Data/Transaction';
import { UTXOModel } from './Data/UTXO';
import './Glyphs.css';
import { poll_settings } from './Settings/SettingsSlice';
import { TXIDAndWTXIDMap } from './util';
import { AppNavbar } from './UX/AppNavbar';
import { Chat } from './UX/Chat/Chat';
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
import { MiniscriptCompiler } from './UX/Miniscript/Compiler';
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
    //React.useEffect(() => {
    //    return window.electron.register_callback('load_contract', (data: string) => {
    //        dispatch(load_new_model(JSON.parse(data)));
    //    });
    //});
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
    const load_new_contract = (
        data: Data | null,
        counter: number,
        trigger_relayout: () => void
    ) => {
        if (contract.current !== null) {
            if (contract.current[1] === counter) {
                return contract.current[0];
            }
        }
        const new_contract = new ContractModel(data ?? { program: {} });
        if (contract.current) model_manager.current.unload(contract.current[0]);
        contract.current = [new_contract, counter];
        model_manager.current.load(new_contract);
        dispatch(set_continuations(new_contract.continuations));
        trigger_relayout();
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
    load_new_contract: (
        data: Data | null,
        counter: number,
        trigger_relayout: () => void
    ) => ContractModel;
}) {
    const bitcoin_node_bar = useSelector(selectStatusBar);
    const { engine, model, load_new_contract } = props;

    // engine is the processor for graphs, we need to load all our custom factories here

    const [contract_data, counter] = useSelector(selectContract);
    const [read_trigger_relayout, set_trigger_relayout] = React.useState(0);
    function trigger_relayout() {
        set_trigger_relayout(read_trigger_relayout + 1);
    }
    // keep the same contract model around as long as we can...
    const current_contract = load_new_contract(
        contract_data,
        counter,
        trigger_relayout
    );

    const is_showing = useSelector(selectShowing);

    const relayout = () => {
        dag.redistribute(props.model);
        engine.repaintCanvas();
        setTimeout(() => engine.zoomToFit(), 0);
    };
    React.useEffect(() => {
        // TODO: Just check that canvas exists
        if (is_showing === 'ContractViewer') relayout();
    }, [read_trigger_relayout]);
    /* current_contract is the contract loaded into the
     * backend logic interface */
    /* state.current_contract is the contract loaded into the
     * ux
     * TODO: Can these be unified?
     */
    /* Bitcoin Node State */
    const dest_ref = React.useRef<BitcoinNodeManager | null>(null);
    const bitcoin_node_manager = React.useMemo(() => {
        if (dest_ref.current) dest_ref.current.destroy();
        const n = new BitcoinNodeManager({
            model: model,
            current_contract: current_contract,
        });
        dest_ref.current = n;
        return n;
    }, [current_contract]);

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
                <div className="App-area">
                    <div className="area-nav">
                        <AppNavbar
                            relayout={relayout}
                            bitcoin_node_manager={bitcoin_node_manager}
                            contract={current_contract}
                        />
                    </div>
                    <div className="area-inner">
                        <Viewing
                            bitcoin_node_manager={bitcoin_node_manager}
                            model={model}
                            engine={engine}
                            current_contract={current_contract}
                        />
                    </div>
                </div>
                <div hidden={!bitcoin_node_bar}>
                    {bitcoin_node_bar && (
                        <BitcoinStatusBar
                            api={bitcoin_node_manager}
                        ></BitcoinStatusBar>
                    )}
                </div>
            </div>
            <Modals
                bitcoin_node_manager={bitcoin_node_manager}
                contract={current_contract}
            />
        </ThemeProvider>
    );
}

function Viewing(props: {
    model: DiagramModel;
    engine: DiagramEngine;
    current_contract: ContractModel;
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    const is_showing = useSelector(selectShowing);
    switch (is_showing) {
        case 'Settings':
            return (
                <Paper className="settings-container" square={true}>
                    <Settings></Settings>
                </Paper>
            );
        case 'Wallet':
            return (
                <Paper className="wallet-container" square={true}>
                    <Wallet
                        bitcoin_node_manager={props.bitcoin_node_manager}
                    ></Wallet>
                </Paper>
            );
        case 'ContractCreator':
            return <CreateContractModal />;
        case 'ContractViewer':
            return <ContractViewer {...props} />;
        case 'MiniscriptCompiler':
            return (
                <Paper className="miniscript-container" square={true}>
                    <MiniscriptCompiler></MiniscriptCompiler>
                </Paper>
            );
        case 'Chat':
            return (
                <Paper className="chat-container" square={true}>
                    <Chat></Chat>
                </Paper>
            );
    }
}
function ContractViewer(props: {
    model: DiagramModel;
    engine: DiagramEngine;
    current_contract: ContractModel;
}) {
    const dispatch = useDispatch();
    const entity_id: EntityType = useSelector(selectEntityToView);
    const show = useSelector(selectShouldViewEntity);
    const theme = useTheme();
    const timing_simulator_enabled = useSelector(selectSimIsShowing);
    const details = entity_id[0] !== 'NULL' && show;
    const { model, engine, current_contract } = props;
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

    return (
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
                <CurrentlyViewedEntity current_contract={current_contract} />
            </Collapse>
            <div className="area-overlays">
                <Collapse in={timing_simulator_enabled}>
                    <SimulationController
                        contract={current_contract}
                        engine={engine}
                        hide={() => dispatch(toggle_showing())}
                    />
                </Collapse>
            </div>
        </>
    );
}
export default App;
