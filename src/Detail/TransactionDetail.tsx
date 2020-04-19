import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from '../Hex';
import { InputDetail } from "./InputDetail";
import { OutputDetail } from "./OutputDetail";
import { TransactionModel } from '../Transaction';
import { Transaction } from 'bitcoinjs-lib';
import { UpdateMessage } from '../EntityViewer';
import { UTXOModel } from '../UTXO';
interface TransactionDetailProps {
    entity: TransactionModel;
    broadcast: (a: Transaction) => Promise<any>;
    update: (a: UpdateMessage) => void;
    find_tx_model: (a: Buffer, b:number) => UTXOModel|null;
    hide_details: () => void;
}
interface IState {
    broadcastable: boolean;
}
export class TransactionDetail extends React.Component<TransactionDetailProps, IState> {
    
    constructor(props:any) {
        super(props);
        this.props.entity.set_broadcastable_hook((b) => this.setState({ broadcastable: b }));
        this.state = {broadcastable: false};
    }
    static getDerivedStateFromProps(props:TransactionDetailProps, state:IState) {
        state.broadcastable = props.entity.is_broadcastable();
        return state;
    }
    render() {
        const broadcast = this.state.broadcastable ? <ListGroup.Item action variant="primary" onClick={() => this.props.broadcast(this.props.entity.tx)}>Broadcast</ListGroup.Item> : null;
        const outs = this.props.entity.utxo_models.map((o, i) => <ListGroup.Item key={i}>
            <OutputDetail txoutput={o} goto={() => this.props.update({ entity: this.props.entity.utxo_models[i]})} />
        </ListGroup.Item>);
        const ins = this.props.entity.tx.ins.map((o, i) => <ListGroup.Item key="input-{i}">
            <InputDetail txinput={o} goto={() => this.props.update({ entity: this.props.find_tx_model(o.hash, o.index)?? this.props.entity})} />
        </ListGroup.Item>);
        // note missing horizontal
        return (<div>
            <h2> Transaction </h2>
            <ListGroup variant="flush">
                
                <ListGroup>
                    {broadcast}
                    <ListGroup.Item action variant="secondary" onClick={this.props.hide_details}>Hide</ListGroup.Item>
                </ListGroup>
                <h3> TXID</h3>
                <ListGroup.Item>
                    <Hex className="txhex" readOnly value={this.props.entity.get_txid()}></Hex>
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
