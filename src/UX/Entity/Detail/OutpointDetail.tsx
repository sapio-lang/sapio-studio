import { IconButton, Tooltip } from '@material-ui/core';
import { green } from '@material-ui/core/colors';
import DoubleArrowIcon from '@material-ui/icons/DoubleArrow';
import React from 'react';
import Hex from './Hex';
import './OutpointDetail.css';
export class OutpointDetail extends React.Component<{
    txid: string;
    n: number;
    onClick: () => void;
}> {
    render() {
        return (
            <div>
                <span>Outpoint:</span>
                <div className="OutpointDetail">
                    <Hex
                        className="txhex"
                        value={this.props.txid.toString() + ':' + this.props.n}
                    />

                    <Tooltip title="Go To the Transaction that created this.">
                        <IconButton
                            aria-label="goto-creating-txn"
                            onClick={() => this.props.onClick()}
                        >
                            <DoubleArrowIcon style={{ color: green[500] }} />
                        </IconButton>
                    </Tooltip>
                </div>
            </div>
        );
    }
}

export class TXIDDetail extends React.Component<{
    txid: string;
}> {
    render() {
        return (
            <div className="TXIDDetail">
                <span>txid:</span>
                <Hex className="txhex" value={this.props.txid} />
            </div>
        );
    }
}
