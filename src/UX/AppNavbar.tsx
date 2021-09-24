import {
    AppBar,
    Button,
    Divider,
    IconButton,
    Link,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { toggle_status_bar } from '../AppSlice';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { ContractModel } from '../Data/ContractManager';
import './AppNavbar.css';
import { set_apis, show_apis } from './ContractCreator/ContractCreatorSlice';
import { CreateContractModal } from './ContractCreator/CreateContractModal';
import { LoadHexModal } from './ContractCreator/LoadHexModal';
import { SapioCompilerModal } from './ContractCreator/SapioCompilerModal';
import { SaveHexModal } from './ContractCreator/SaveHexModal';
import { ViewContractModal } from './ContractCreator/ViewContractModal';
import SettingsIcon from '@mui/icons-material/Settings';
export function AppNavbar(props: {
    toggle_timing_simulator: () => void;
    contract: ContractModel;
    bitcoin_node_manager: BitcoinNodeManager;
}): JSX.Element {
    const dispatch = useDispatch();
    const [modalView, setModalView] = useState(false);

    const [modalSapioCompiler, setModalaSapioCompiler] = useState(false);

    const [modalLoadHex, setModalLoadHex] = useState(false);
    const [modalSaveHex, setModalSaveHex] = useState(false);

    const contractRef = React.useRef<HTMLButtonElement>(null);
    const [contracts_open, setContractsOpen] = React.useState(false);

    const nodeRef = React.useRef<HTMLButtonElement>(null);
    const [node_open, setNodeOpen] = React.useState(false);
    const simulateRef = React.useRef<HTMLButtonElement>(null);
    const [sim_open, setSimOpen] = React.useState(false);
    return (
        <>
            <AppBar position="static" className="Draggable">
                <Toolbar>
                    <Button
                        ref={contractRef}
                        onClick={() => setContractsOpen(true)}
                        color="inherit"
                    >
                        Contract
                    </Button>
                    <Menu
                        anchorEl={contractRef.current}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                        }}
                        keepMounted
                        open={contracts_open}
                        onClose={() => setContractsOpen(false)}
                    >
                        <MenuItem
                            onClick={() => {
                                setContractsOpen(false);
                                setModalLoadHex(true);
                            }}
                        >
                            Open Contract from Clipboard
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setContractsOpen(false);
                                window.electron.open_contract_from_file();
                            }}
                        >
                            Open Contract from File
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setContractsOpen(false);
                                setModalSaveHex(true);
                            }}
                        >
                            Save Contract
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setContractsOpen(false);
                                window.electron.load_wasm_plugin();
                            }}
                        >
                            Load WASM Plugin
                        </MenuItem>
                        <MenuItem
                            onClick={async () => {
                                setContractsOpen(false);
                                dispatch(
                                    set_apis(
                                        await window.electron.load_contract_list()
                                    )
                                );
                                dispatch(show_apis(true));
                            }}
                        >
                            Create New Contract
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setContractsOpen(false);
                                window.electron.recreate_contract();
                            }}
                        >
                            Recreate Last Contract
                        </MenuItem>
                    </Menu>
                    <Button
                        ref={nodeRef}
                        onClick={() => setNodeOpen(true)}
                        color="inherit"
                    >
                        Bitcoin Node
                    </Button>
                    <Menu
                        anchorEl={nodeRef.current}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                        }}
                        keepMounted
                        open={node_open}
                        onClose={() => setNodeOpen(false)}
                    >
                        <MenuItem
                            onClick={async () => {
                                setNodeOpen(false);
                                const addr = await props.bitcoin_node_manager.get_new_address();
                                window.electron.write_clipboard(addr);
                            }}
                        >
                            Get New Address to Clipboard
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setNodeOpen(false);
                                props.bitcoin_node_manager.generate_blocks(10);
                            }}
                        >
                            Generate 10 Blocks
                        </MenuItem>
                        <Divider />
                        <MenuItem
                            onClick={() => {
                                setNodeOpen(false);
                                dispatch(toggle_status_bar());
                            }}
                        >
                            Toggle Status
                        </MenuItem>
                    </Menu>
                    <Button
                        ref={simulateRef}
                        onClick={() => setSimOpen(true)}
                        color="inherit"
                    >
                        Simulate
                    </Button>
                    <Menu
                        anchorEl={simulateRef.current}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                        }}
                        keepMounted
                        open={sim_open}
                        onClose={() => setSimOpen(false)}
                    >
                        <MenuItem
                            onClick={() => {
                                setSimOpen(false);
                                props.toggle_timing_simulator();
                            }}
                        >
                            Timing
                        </MenuItem>
                    </Menu>
                    <div style={{ flex: 1 }} />
                    <IconButton
                        color="inherit"
                        onClick={() => {
                            setContractsOpen(false);
                            window.electron.show_preferences();
                        }}
                    >
                        <SettingsIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <div>
                <CreateContractModal />
                <ViewContractModal
                    show={modalView}
                    hide={() => setModalView(false)}
                    bitcoin_node_manager={props.bitcoin_node_manager}
                />

                <SapioCompilerModal
                    show={modalSapioCompiler}
                    hide={() => setModalaSapioCompiler(false)}
                />

                <LoadHexModal
                    show={modalLoadHex}
                    hide={() => setModalLoadHex(false)}
                />

                <SaveHexModal
                    show={modalSaveHex}
                    hide={() => setModalSaveHex(false)}
                    contract={props.contract}
                />
            </div>
        </>
    );
}
