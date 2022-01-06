import { clamp } from 'lodash';
import React from 'react';
import { BitcoinNodeManager } from './BitcoinNode';
import './BitcoinStatusBar.css';
import { AppBar, Toolbar, Typography, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import { selectNodePollFreq } from '../Settings/SettingsSlice';
interface BitcoinStatusBarProps {
    api: BitcoinNodeManager;
}
export function BitcoinStatusBar(props: BitcoinStatusBarProps) {
    const freq = useSelector(selectNodePollFreq);
    const [balance, setBalance] = React.useState<number>(0);
    const [blockchaininfo, setBlockchaininfo] = React.useState<any>(null);
    React.useEffect(() => {
        let next: ReturnType<typeof setTimeout> | null = null;
        let mounted = true;
        const periodic_update_stats = async () => {
            next = null;
            const balance: number = await props.api.check_balance();
            const info = await props.api.blockchaininfo();
            console.log(balance);
            setBalance(balance);
            setBlockchaininfo(info);
            let prefs = freq;
            prefs = clamp(prefs, 5, 5 * 60);
            if (mounted) next = setTimeout(periodic_update_stats, prefs * 1000);
        };
        next = setTimeout(periodic_update_stats, freq * 1000);
        return () => {
            mounted = false;
            if (next !== null) clearTimeout(next);
        };
    }, []);
    const theme = useTheme();
    const network = blockchaininfo?.chain ?? 'disconnected';
    const headers = blockchaininfo?.headers ?? '?';
    const blocks = blockchaininfo?.headers ?? '?';
    return (
        <AppBar
            position="fixed"
            sx={{
                top: 'auto',
                bottom: 0,
                zIndex: (theme) => theme.zIndex.drawer + 1,
            }}
            className="BitcoinStatusBar Draggable"
            style={{
                background: theme.palette.background.default,
                color: theme.palette.info.main,
            }}
        >
            <Toolbar variant="dense">
                <Typography variant="h6" color="inherit" component="div">
                    <div>chain: {network}</div>
                </Typography>
                <Typography variant="h6" color="inherit" component="div">
                    <div>balance: {balance} BTC</div>
                </Typography>
                <Typography variant="h6" color="inherit" component="div">
                    <div>
                        processed: {blocks}/{headers}
                    </div>
                </Typography>
            </Toolbar>
        </AppBar>
    );
}
