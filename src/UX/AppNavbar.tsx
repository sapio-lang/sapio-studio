import SettingsIcon from '@mui/icons-material/Settings';
import {
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
} from '@mui/material';
import React from 'react';
import { useDispatch } from 'react-redux';
import {
    create_contract_from_file,
    recreate_contract,
    switch_showing,
    toggle_status_bar,
} from '../AppSlice';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { ContractModel } from '../Data/ContractManager';
import { toggle_showing } from '../Data/SimulationSlice';
import './AppNavbar.css';
import { set_apis } from './ContractCreator/ContractCreatorSlice';
import { open_modal } from './ModalSlice';
export function AppNavbar(props: {
    relayout: () => void;
    contract: ContractModel;
    bitcoin_node_manager: BitcoinNodeManager;
}): JSX.Element {
    const dispatch = useDispatch();

    return (
        <Paper className="AppNavBar" square={true}>
            <List>
                <MainScreens></MainScreens>
            </List>
            <Divider />
            <List>
                <ContractMenu relayout={props.relayout} />
                <NodeMenu bitcoin_node_manager={props.bitcoin_node_manager} />
                <Simulator />
            </List>
            <Divider />
            <List>
                <SettingsMenuItem />
            </List>
            <Divider />
        </Paper>
    );
}

function SettingsMenuItem() {
    const dispatch = useDispatch();
    return (
        <ListItem
            disableGutters
            button={false}
            key={'settings'}
            onClick={() => dispatch(switch_showing('Settings'))}
        >
            <ListItemIcon>
                <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary={'Settings'} />
        </ListItem>
    );
}
function Simulator() {
    const dispatch = useDispatch();
    const simulateRef = React.useRef<HTMLLIElement>(null);
    const [sim_open, setSimOpen] = React.useState(false);
    return (
        <div>
            <ListItem
                disableGutters
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
                        dispatch(toggle_showing());
                    }}
                >
                    Timing
                </MenuItem>
            </Menu>
        </div>
    );
}

function MainScreens() {
    const dispatch = useDispatch();
    return (
        <>
            <ListItem
                disableGutters
                button={true}
                key={'Wallet'}
                onClick={() => dispatch(switch_showing('Wallet'))}
            >
                <ListItemIcon></ListItemIcon>
                <ListItemText primary={'Wallet'} />
            </ListItem>
            <ListItem
                disableGutters
                button={true}
                key={'Contract Creator'}
                onClick={() => dispatch(switch_showing('ContractViewer'))}
            >
                <ListItemIcon></ListItemIcon>
                <ListItemText primary={'Contract Creator'} />
            </ListItem>
        </>
    );
}
function ContractMenu(props: { relayout: () => void }) {
    const dispatch = useDispatch();
    const contractRef = React.useRef<HTMLLIElement>(null);
    const [contracts_open, setContractsOpen] = React.useState(false);

    return (
        <div>
            <ListItem
                disableGutters
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
                        dispatch(open_modal('LoadHex'));
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
                        dispatch(open_modal('SaveHex'));
                    }}
                >
                    Save Contract
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setContractsOpen(false);
                        window.electron.sapio.load_wasm_plugin();
                    }}
                >
                    Load WASM Plugin
                </MenuItem>
                <MenuItem
                    onClick={async () => {
                        setContractsOpen(false);
                        const apis =
                            await window.electron.sapio.load_contract_list();
                        if ('err' in apis) {
                            alert(apis.err);
                            return;
                        }
                        dispatch(set_apis(apis.ok));
                        dispatch(switch_showing('ContractCreator'));
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
                <Divider />
                <MenuItem
                    onClick={() => {
                        props.relayout();
                    }}
                >
                    Repair Layout
                </MenuItem>
            </Menu>
        </div>
    );
}
function NodeMenu(props: { bitcoin_node_manager: BitcoinNodeManager }) {
    const dispatch = useDispatch();
    const nodeRef = React.useRef<HTMLLIElement>(null);
    const [node_open, setNodeOpen] = React.useState(false);
    const close = () => setNodeOpen(false);

    return (
        <>
            <ListItem
                disableGutters
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
                onClose={close}
            >
                <MenuItem
                    onClick={async () => {
                        close();
                        const addr =
                            await props.bitcoin_node_manager.get_new_address();
                        window.electron.write_clipboard(addr);
                    }}
                >
                    Get New Address to Clipboard
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        close();
                        props.bitcoin_node_manager
                            .generate_blocks(10)
                            .catch((err) => console.error(err));
                    }}
                >
                    Generate 10 Blocks
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={() => {
                        close();
                        dispatch(toggle_status_bar());
                    }}
                >
                    Toggle Status
                </MenuItem>
            </Menu>
        </>
    );
}
