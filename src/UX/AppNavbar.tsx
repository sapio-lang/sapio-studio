import {
    Drawer,
    Button,
    Divider,
    IconButton,
    Link,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    create_contract_from_file,
    recreate_contract,
    toggle_status_bar,
} from '../AppSlice';
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

    const contractRef = React.useRef<HTMLLIElement>(null);
    const [contracts_open, setContractsOpen] = React.useState(false);

    const nodeRef = React.useRef<HTMLLIElement>(null);
    const [node_open, setNodeOpen] = React.useState(false);
    const simulateRef = React.useRef<HTMLLIElement>(null);
    const [sim_open, setSimOpen] = React.useState(false);
    return (
        <Paper className="Draggable" square={true}>
            <List>
                <ListItem
                    button={false}
                    key={'Contract'}
                    onClick={() => setContractsOpen(true)}
                    ref={contractRef}
                >
                    <ListItemIcon></ListItemIcon>
                    <ListItemText primary={'Contract'} />
                </ListItem>
                <Menu
                    anchorEl={contractRef.current}
                    anchorOrigin={{
                        vertical: 'center',
                        horizontal: 'right',
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
                            dispatch(create_contract_from_file());
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
                            dispatch(recreate_contract());
                        }}
                    >
                        Recreate Last Contract
                    </MenuItem>
                </Menu>

                <ListItem
                    button={false}
                    key={'Bitcoin Node'}
                    onClick={() => setNodeOpen(true)}
                    ref={nodeRef}
                >
                    <ListItemIcon></ListItemIcon>
                    <ListItemText primary={'Bitcoin Node'} />
                </ListItem>
                <Menu
                    anchorEl={nodeRef.current}
                    anchorOrigin={{
                        vertical: 'center',
                        horizontal: 'right',
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

                <ListItem
                    button={false}
                    key={'Simulate'}
                    onClick={() => setSimOpen(true)}
                    ref={simulateRef}
                >
                    <ListItemIcon></ListItemIcon>
                    <ListItemText primary={'Simulate'} />
                </ListItem>
                <Menu
                    anchorEl={simulateRef.current}
                    anchorOrigin={{
                        vertical: 'center',
                        horizontal: 'right',
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
            </List>
            <Divider />
            <List>
                <ListItem
                    button={false}
                    key={'settings'}
                    onClick={() => {
                        setContractsOpen(false);
                        window.electron.show_preferences();
                    }}
                >
                    <ListItemIcon>
                        <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary={'Settings'} />
                </ListItem>
            </List>
            <Divider />
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
        </Paper>
    );
}
