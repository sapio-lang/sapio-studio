import { Tab, Tabs } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import './Wallet.css';
import { ContractList } from './ContractList';
import { WalletSend } from './WalletSend';
import { WalletHistory } from './WalletHistory';
import { Workspaces } from './Workspaces';
import { useDispatch, useSelector } from 'react-redux';
import {
    selectWalletTab,
    switch_wallet_tab,
    TabIndexes,
} from './Slice/Reducer';

export function Wallet(props: { bitcoin_node_manager: BitcoinNodeManager }) {
    const dispatch = useDispatch();
    const idx = useSelector(selectWalletTab);
    const handleChange = (_: any, idx: TabIndexes) => {
        dispatch(switch_wallet_tab(idx));
    };
    return (
        <div className="Wallet">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={idx}
                    onChange={handleChange}
                    aria-label="basic tabs example"
                >
                    <Tab label="Send"></Tab>
                    <Tab label="Send History"></Tab>
                    <Tab label="Workspaces"></Tab>
                    <Tab label="Contracts"></Tab>
                </Tabs>
            </Box>
            <Box sx={{ overflowY: 'scroll', height: '100%' }}>
                <WalletSend value={0} idx={idx} {...props}></WalletSend>
                <WalletHistory value={1} idx={idx} {...props}></WalletHistory>
                <Workspaces value={2} idx={idx}></Workspaces>
                <ContractList value={3} idx={idx}></ContractList>
            </Box>
        </div>
    );
}
