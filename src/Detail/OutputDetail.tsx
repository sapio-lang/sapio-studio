import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from './Hex';
import { UTXOModel } from '../Data/UTXO';
import { pretty_amount } from '../util';

interface OutputDetailProps {
    txoutput: UTXOModel;
    goto: () => void
}
export class OutputDetail extends React.Component<OutputDetailProps> {
    render() {
        const decomp = Bitcoin.script.decompile(this.props.txoutput.utxo.script)?? new Buffer("");
        const script = Bitcoin.script.toASM(decomp);
        return (<>
            <ListGroup variant="flush">
                <h6> {pretty_amount(this.props.txoutput.utxo.amount)} </h6>
                <Hex readOnly className="txhex" value={script} />
                <ListGroup.Item action variant="success" onClick={this.props.goto}> Go </ListGroup.Item>
            </ListGroup>
        </>);
    }
}
