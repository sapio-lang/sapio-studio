import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from '../Hex';
import { InputDetail } from "./InputDetail";
import { OutputDetail } from "./OutputDetail";
import { TransactionModel } from '../Transaction';
import { Transaction } from 'bitcoinjs-lib';
import { UTXOModel } from '../UTXO';
import { OutpointDetail, TXIDDetail } from './OutpointDetail';
interface TransactionDetailProps {
    entity: TransactionModel;
    broadcast: (a: Transaction) => Promise<any>;
    find_tx_model: (a: Buffer, b: number) => UTXOModel | null;
}
interface IState {
    broadcastable: boolean;
}
export class TransactionDetail extends React.Component<TransactionDetailProps, IState> {

    constructor(props: any) {
        super(props);
        this.props.entity.set_broadcastable_hook((b) => this.setState({ broadcastable: b }));
        this.state = { broadcastable: false };
    }
    static getDerivedStateFromProps(props: TransactionDetailProps, state: IState) {
        state.broadcastable = props.entity.is_broadcastable();
        return state;
    }

    componentWillMount() {
        this.props.entity.setSelected(true);
    }
    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x:UTXOModel|TransactionModel) {
        this.props.entity.setSelected(false);
        x.setSelected(true);
    }
    render() {
        const broadcast = !this.state.broadcastable ? null :
            <ListGroup variant="flush">
                <ListGroup.Item action variant="primary" onClick={() => this.props.broadcast(this.props.entity.tx)}>
                    Broadcast
            </ListGroup.Item>
            </ListGroup>;
        const outs = this.props.entity.utxo_models.map((o, i) =>
            <ListGroup.Item key={i}>
                <OutputDetail txoutput={o} goto={() => this.goto(this.props.entity.utxo_models[i])} />
            </ListGroup.Item>);
        const ins = this.props.entity.tx.ins.map((o, i) => {
            const witnesses: Buffer[][] = this.props.entity.witness_set.map((w) => w[i]);
            console.log(witnesses);
            return <ListGroup.Item key="input-{i}">
                <InputDetail txinput={o} 
                    goto={() => this.goto(this.props.find_tx_model(o.hash, o.index) ?? this.props.entity)}
                    witnesses={witnesses} />
            </ListGroup.Item>;
        });



        // note missing horizontal
        return (<>
            {broadcast}
            <hr />
            <TXIDDetail txid={this.props.entity.get_txid()} />
            <ListGroup variant="flush">
                <ListGroup.Item>
                    <h4> Inputs</h4>

                </ListGroup.Item>
                <ListGroup.Item>
                    <ListGroup variant="flush">{ins}</ListGroup>
                </ListGroup.Item>
            </ListGroup>
            <ListGroup variant="flush">
                <ListGroup.Item>

                    <h4>Outputs</h4>
                </ListGroup.Item>
                <ListGroup.Item>
                    <ListGroup variant="flush">{outs}</ListGroup>
                </ListGroup.Item>
            </ListGroup>
            <ListGroup>
                <ListGroup.Item>
                    <h4> Tx Hex </h4>

                </ListGroup.Item>
                <ListGroup.Item>
                    <Hex value={this.props.entity.tx.toHex()} readOnly className="txhex"> </Hex>
                </ListGroup.Item>
            </ListGroup>
        </>);
    }
}
