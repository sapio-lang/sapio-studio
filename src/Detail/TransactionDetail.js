import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from '../Hex';
import { InputDetail } from "./InputDetail";
import { Output } from '../Transaction';
export class TransactionDetail extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.state.broadcastable = this.props.entity.is_broadcastable();
        this.props.entity.set_broadcastable_hook((b) => this.setState({ broadcastable: b }));
    }
    static getDerivedStateFromProps(props, state) {
        state.broadcastable = props.entity.is_broadcastable();
    }
    render() {
        const broadcast = this.state.broadcastable ? <ListGroup.Item action variant="primary" onClick={() => this.props.entity.broadcast()}>Broadcast</ListGroup.Item> : null;
        const outs = this.props.entity.tx.outs.map((o, i) => <ListGroup.Item key={i}>
            <Output txoutput={o} update={() => this.props.update({ entity: this.props.entity.utxo_models[i] })} />
        </ListGroup.Item>);
        const ins = this.props.entity.tx.ins.map((o, i) => <ListGroup.Item key="input-{i}">
            <InputDetail txinput={o} update={() => this.props.update({ entity: this.props.find_tx_model(o.hash, o.index) })} />
        </ListGroup.Item>);
        return (<div>
            <h2> Transaction </h2>
            <ListGroup variant="flush">
                <ListGroup horizontal>
                    {broadcast}
                    <ListGroup.Item action variant="secondary" onClick={this.props.hide_details}>Hide</ListGroup.Item>
                </ListGroup>
                <h3> TXID</h3>
                <ListGroup.Item>
                    <Hex className="txhex" readOnly value={this.props.entity.tx.getTXID()}></Hex>
                </ListGroup.Item>
                <h3> Inputs</h3>
                {ins}
                <h3>Outputs</h3>
                {outs}
                <h3> Tx Hex </h3>
                <ListGroup.Item>
                    <Hex value={this.props.entity.tx.toHex()} readOnly className="txhex"> </Hex>
                </ListGroup.Item>
            </ListGroup>
        </div>);
    }
}
