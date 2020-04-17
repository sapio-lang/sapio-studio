import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from '../Hex';
import { UTXOModel } from '../UTXO';

interface OutputDetailProps {
    txoutput: UTXOModel;
    update: () => void
}
export class OutputDetail extends React.Component<OutputDetailProps> {
    render() {
        const decomp = Bitcoin.script.decompile(this.props.txoutput.utxo.script)?? new Buffer("");
        const script = Bitcoin.script.toASM(decomp);
        return (<>
            <h4> {this.props.txoutput.value / 100e6} BTC </h4>
            <Hex readOnly className="txhex" value={script} />
            <ListGroup>
                <ListGroup.Item action variant="primary" onClick={this.props.update}> Go </ListGroup.Item>
            </ListGroup>
        </>);
    }
}
