import React from 'react';
import { BitcoinNodeManager } from './BitcoinNode';
import './BitcoinStatusBar.css';
interface BitcoinStatusBarProps {
    api: BitcoinNodeManager;
}
interface BitcoinStatusBarState {
    balance: number;
    blockchaininfo: any;
}
export class BitcoinStatusBar extends React.Component<
    BitcoinStatusBarProps,
    BitcoinStatusBarState
> {
    mounted: boolean;
    constructor(props: BitcoinStatusBarProps) {
        super(props);
        this.mounted = false;
        this.state = { balance: 0, blockchaininfo: null };
    }
    componentDidMount() {
        this.mounted = true;
        setTimeout(this.periodic_update_stats.bind(this), 10);
    }
    async periodic_update_stats() {
        this.setState({ balance: await this.props.api.check_balance() });
        this.setState({
            blockchaininfo: await this.props.api.blockchaininfo(),
        });
        if (this.mounted) {
            setTimeout(this.periodic_update_stats.bind(this), 10 * 1000);
        }
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    render() {
        if (this.state.blockchaininfo === null) return null;
        const network = this.state.blockchaininfo.chain;
        const headers = this.state.blockchaininfo.headers;
        const blocks = this.state.blockchaininfo.headers;
        return (
            <div className="BitcoinStatusBar">
                <div>chain: {network}</div>
                <div>balance: {this.state.balance} BTC</div>
                <div>
                    processed: {blocks}/{headers}
                </div>
            </div>
        );
    }
}
