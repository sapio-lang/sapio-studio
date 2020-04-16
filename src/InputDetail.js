import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Collapse from 'react-bootstrap/Collapse';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { hash_to_hex } from './Hex';
import { Transaction } from './Transaction';
export class InputDetail extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.state.open = false;
        this.hash = hash_to_hex(this.props.txinput.hash);
    }
    render() {
        const maybeDecode = (d, elt) => d ? Bitcoin.script.toASM(Bitcoin.script.decompile(elt)) : elt.toString('hex');
        const witness = []; /*this.props.txinput.witness.map((elt,i) =>
            (<ListGroup.Item key={i}>
                <Hex readOnly className="txhex" value={maybeDecode(i === (this.props.txinput.witness.length -1), elt)}></Hex>
            </ListGroup.Item>)
        );*/
        const scriptValue = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txinput.script));
        ;
        const script = this.props.txinput.script.length > 0 ?
            <>
                <h4>Script</h4>
                <Hex readOnly className="txhex" value={scriptValue}></Hex>
            </> : null;
        const sequence = this.props.txinput.sequence === Transaction.DEFAULT_SEQUENCE ? null :
            <h4>Sequence: {this.props.txinput.sequence} </h4>;
        return (<div>
            <h4> OutPoint </h4>
            <h5>Hash</h5>
            <Hex readOnly className="txhex" value={this.hash} />
            <h5>N: {this.props.txinput.index} </h5>

            <ListGroup horizontal>
                <ListGroup.Item action variant="primary" onClick={this.props.update}>
                    Go
                        </ListGroup.Item>
                <ListGroup.Item action variant="secondary" onClick={() => this.setState({ open: !this.state.open })} aria-controls="input-data" aria-expanded={this.state.open}>
                    {this.state.open ? "Less" : "More"}...
                        </ListGroup.Item>
            </ListGroup>
            <Collapse in={this.state.open}>
                <div>
                    {sequence}
                    {script}
                    <h4>Witness</h4>
                    {witness}
                </div>
            </Collapse>
        </div>);
    }
}
