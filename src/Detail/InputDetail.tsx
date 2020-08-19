import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Collapse from 'react-bootstrap/Collapse';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { hash_to_hex } from './Hex';
import { OutpointDetail } from './OutpointDetail';
import Form from 'react-bootstrap/Form';
interface IProps {
    txinput: Bitcoin.TxInput;
    witnesses: Buffer[][];
    goto: () => void;

}
interface IState {
    open: boolean;
    witness_selection: number|undefined;

}
function maybeDecode(to_asm: boolean, elt: Buffer): string {
    if (to_asm) {
        return Bitcoin.script.toASM(Bitcoin.script.decompile(elt) ?? new Buffer(""))
    } else {
        return elt.toString('hex');
    }
}
export class InputDetail extends React.Component<IProps, IState> {
    form: any;
    constructor(props: IProps) {
        super(props);
        this.state = { open: false, witness_selection: undefined};
        this.form = null;
    }
    render() {
        const witness_display = this.state.witness_selection === undefined ? null :
            this.props.witnesses[this.state.witness_selection].map((elt, i) =>
                (<ListGroup.Item key={i} variant="dark">
                    <Hex readOnly
                        className="txhex"
                        value={maybeDecode(true || i === (this.props.witnesses[this.state.witness_selection ?? 0].length - 1), elt)} />
                </ListGroup.Item>)
            );
        const scriptValue = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txinput.script) ?? new Buffer(""));
        ;
        const sequence = this.props.txinput.sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE ? null :
            <h6>Sequence: {this.props.txinput.sequence} </h6>;
        const witness = this.props.witnesses.map((w, i) => <option key={i} value={i}> {i} </option>);
        // missing horizontal
        return (<div>
            <ListGroup variant="flush">
                <ListGroup.Item variant="dark">
                    <OutpointDetail txid={hash_to_hex(this.props.txinput.hash)} n={this.props.txinput.index}
                        onClick={this.props.goto} />
                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    {sequence}
                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <h6>Script:</h6>
                    <Hex readOnly className="txhex" value={scriptValue}></Hex>
                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <Form onChange={() => {console.log(this.form); this.setState({ witness_selection: this.form.value ||undefined}) }}>
                        <Form.Group>
                            <Form.Label>
                                <h6> Witness {this.state.witness_selection}</h6>
                            </Form.Label>
                            <Form.Control as="select" ref={r => { this.form = r; }}>
                                <option value={undefined}></option>
                                {witness}
                            </Form.Control>
                        </Form.Group>
                    </Form>
                    <ListGroup>
                        {witness_display}
                    </ListGroup>
                </ListGroup.Item>
            </ListGroup>

        </div>);
    }
}
