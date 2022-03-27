import { Tab, Tabs } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import './Wallet.css';
import { ContractList } from './ContractList';
import { WalletSend } from './WalletSend';
import { WalletHistory } from './WalletHistory';

export function Wallet(props: { bitcoin_node_manager: BitcoinNodeManager }) {
    const [idx, set_idx] = React.useState(0);
    const handleChange = (_: any, idx: number) => {
        set_idx(idx);
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
                <ContractList value={2} idx={idx}></ContractList>
                <ContractList value={3} idx={idx}></ContractList>
            </Box>
        </div>
    );
}
