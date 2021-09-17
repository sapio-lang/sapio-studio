import { clamp } from 'lodash';
import React from 'react';
import { BitcoinNodeManager } from './BitcoinNode';
import './BitcoinStatusBar.css';
import { useTheme } from '@material-ui/core';
interface BitcoinStatusBarProps {
    api: BitcoinNodeManager;
}
export function BitcoinStatusBar(props: BitcoinStatusBarProps) {
    const [balance, setBalance] = React.useState(0);
    const [blockchaininfo, setBlockchaininfo] = React.useState<any>(null);
    React.useEffect(() => {
        let next: ReturnType<typeof setTimeout> | null = null;
        let mounted = true;
        async function periodic_update_stats() {
            next = null;
            setBalance(await props.api.check_balance());
            setBlockchaininfo(await props.api.blockchaininfo());
            let prefs =
                window.electron.get_preferences_sync().display[
                    'poll-node-freq'
                ] ?? 0;
            prefs = clamp(prefs, 5, 5 * 60);
            if (mounted) next = setTimeout(periodic_update_stats, prefs * 1000);
        }
        next = setTimeout(periodic_update_stats, 10);
        return () => {
            mounted = false;
            if (next !== null) clearTimeout(next);
        };
    });
    const theme = useTheme();
    const network = blockchaininfo?.chain ?? 'disconnected';
    const headers = blockchaininfo?.headers ?? '?';
    const blocks = blockchaininfo?.headers ?? '?';
    return (
        <div
            className="BitcoinStatusBar"
            style={{
                background: theme.palette.background.default,
                color: theme.palette.info.main,
            }}
        >
            <div>chain: {network}</div>
            <div>balance: {balance} BTC</div>
            <div>
                processed: {blocks}/{headers}
            </div>
        </div>
    );
}
