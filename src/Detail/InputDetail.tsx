import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Collapse from 'react-bootstrap/Collapse';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { hash_to_hex } from '../Hex';
interface IProps {
    txinput: Bitcoin.TxInput;
    goto: () => void;

}
interface IState {
    open: boolean;

}
function maybeDecode(to_asm: boolean, elt: Buffer): string {
    if (to_asm) {
        return Bitcoin.script.toASM(Bitcoin.script.decompile(elt) ?? new Buffer(""))
    } else {
        return elt.toString('hex');
    }
}
export class InputDetail extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = { open: false };
    }
    render() {
        const witness: any[] = this.props.txinput.witness.map((elt, i) =>
            (<ListGroup.Item key={i}>
                <Hex readOnly
                    className="txhex"
                    value={maybeDecode(i === (this.props.txinput.witness.length - 1), elt)} />
            </ListGroup.Item>)
        );
        const scriptValue = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txinput.script) ?? new Buffer(""));
        ;
        const script = this.props.txinput.script.length > 0 ?
            <>
                <h4>Script</h4>
                <Hex readOnly className="txhex" value={scriptValue}></Hex>
            </> : null;
        const sequence = this.props.txinput.sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE ? null :
            <h4>Sequence: {this.props.txinput.sequence} </h4>;
        // missing horizontal
        return (<div>
            <h4> OutPoint </h4>
            <h5>Hash</h5>
            <Hex readOnly className="txhex" value={hash_to_hex(this.props.txinput.hash)} />
            <h5>N: {this.props.txinput.index} </h5>

            <ListGroup>
                <ListGroup.Item action variant="primary" onClick={this.props.goto}> Go </ListGroup.Item>
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
