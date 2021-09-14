import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from './Hex';
import { UTXOModel } from '../../../Data/UTXO';
import { PrettyAmount } from '../../../util';
import Button from 'react-bootstrap/esm/Button';
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
                <Button variant="link" onClick={() => this.props.goto()}>
                    <span
                        className="glyphicon glyphicon-chevron-right"
                        style={{ color: 'green' }}
                        title="Go to the transaction that created this."
                    ></span>
                </Button>
            </div>
        );
    }
}
