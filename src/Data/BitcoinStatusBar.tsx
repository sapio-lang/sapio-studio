import React from 'react';
import { BitcoinNodeManager } from './BitcoinNode';
interface BitcoinStatusBarProps {
    api: BitcoinNodeManager;
}
interface BitcoinStatusBarState {
    balance: number;

}
export class BitcoinStatusBar extends React.Component<BitcoinStatusBarProps, BitcoinStatusBarState> {
    mounted: boolean;
    constructor(props: BitcoinStatusBarProps) {
        super(props);
        this.mounted = false;
        this.state = {balance: 0};
    }
    componentDidMount() {
        this.mounted = true;
        setTimeout(this.periodic_update_stats.bind(this), 10);
    }
    async periodic_update_stats(){
        this.setState({balance: await this.props.api.check_balance()})
        if (this.mounted) {
            setTimeout(this.periodic_update_stats.bind(this), 10*1000);
        }
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    render() {
        return (
            <div>
                balance: {this.state.balance}
            </div>
        );
    }
}
