import { IconButton, Tooltip } from '@material-ui/core';
import { green } from '@material-ui/core/colors';
import DoubleArrowIcon from '@material-ui/icons/DoubleArrow';
import React from 'react';
import { useDispatch } from 'react-redux';
import { select_txn, select_utxo } from '../EntitySlice';
import Hex from './Hex';
import './OutpointDetail.css';
export function OutpointDetail(props: { txid: string; n: number }) {
    const dispatch = useDispatch();
    return (
        <div className="OutpointDetail">
            <Hex
                className="txhex"
                label="Outpoint"
                value={props.txid.toString() + ':' + props.n}
            />
            <Tooltip title="Go To the Transaction that created this.">
                <IconButton
                    aria-label="goto-creating-txn"
                    onClick={() => dispatch(select_txn(props.txid))}
                >
                    <DoubleArrowIcon style={{ color: green[500] }} />
                </IconButton>
            </Tooltip>
        </div>
    );
}

export function RefOutpointDetail(props: { txid: string; n: number }) {
    const dispatch = useDispatch();
    return (
        <div className="OutpointDetail">
            <Hex
                className="txhex"
                label="Outpoint"
                value={props.txid.toString() + ':' + props.n}
            />
            <Tooltip title="Go to this outpoint">
                <IconButton
                    aria-label="goto-this-outpoint"
                    onClick={() =>
                        dispatch(
                            select_utxo({
                                hash: props.txid,
                                nIn: props.n,
                            })
                        )
                    }
                >
                    <DoubleArrowIcon style={{ color: green[500] }} />
                </IconButton>
            </Tooltip>
        </div>
    );
}

export class TXIDDetail extends React.Component<{
    txid: string;
}> {
    render() {
        return <Hex className="txhex" value={this.props.txid} label="TXID" />;
    }
}
