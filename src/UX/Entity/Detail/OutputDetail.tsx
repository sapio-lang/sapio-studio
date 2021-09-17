import { IconButton, Tooltip } from '@material-ui/core';
import { green } from '@material-ui/core/colors';
import DoubleArrowIcon from '@material-ui/icons/DoubleArrow';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { UTXOModel } from '../../../Data/UTXO';
import { PrettyAmount } from '../../../util';
import Hex from './Hex';
import './OutputDetail.css';

interface OutputDetailProps {
    txoutput: UTXOModel;
    goto: () => void;
}
export class OutputDetail extends React.Component<OutputDetailProps> {
    render() {
        const decomp =
            Bitcoin.script.decompile(this.props.txoutput.utxo.script) ??
            Buffer.from('');
        const script = Bitcoin.script.toASM(decomp);
        return (
            <div className="OutputDetail">
                <span> {PrettyAmount(this.props.txoutput.utxo.amount)} </span>
                <Hex className="txhex" value={script} />
                <Tooltip title="Go To the Transaction that created this.">
                    <IconButton
                        aria-label="goto-creating-txn"
                        onClick={() => this.props.goto()}
                    >
                        <DoubleArrowIcon style={{ color: green[500] }} />
                    </IconButton>
                </Tooltip>
            </div>
        );
    }
}
