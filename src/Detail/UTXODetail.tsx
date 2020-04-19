import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex from '../Hex';
import { UTXOModel } from '../UTXO';
import { UpdateMessage } from '../EntityViewer';
import { pretty_amount, get_wtxid_backwards } from '../util';

interface UTXODetailProps {
    entity: UTXOModel;
    update: (a:UpdateMessage) => void;
    hide_details: () => void;
}
export class UTXODetail extends React.Component<UTXODetailProps> {
    render() {
        if (!this.props.entity)
            return null;
        if (!this.props.entity.utxo)
            return null;
        const spends = this.props.entity.utxo.spends.map((elt, i) => <div key={get_wtxid_backwards(elt.tx)}>
            <ListGroup.Item>
                <Hex value={elt.get_txid()} />
            </ListGroup.Item>
            <ListGroup.Item action variant="primary" onClick={() => this.props.update({ entity: elt})}> Go</ListGroup.Item>
        </div>);
        return (<div>
            <h2> UTXO </h2>
            <ListGroup>
                <ListGroup.Item action variant="secondary" onClick={this.props.hide_details}>Hide</ListGroup.Item>
            </ListGroup>
            <h3> Outpoint </h3>
            <h4>Hash</h4>
            <Hex className="txhex" readOnly value={this.props.entity.txn.get_txid()} />
            <h4>N: {this.props.entity.utxo.index}</h4>
            <ListGroup>
                <ListGroup.Item action variant="primary" onClick={() => this.props.update({ entity: this.props.entity.txn})}>Go</ListGroup.Item>
            </ListGroup>
            <h3> Amount </h3>
            <h4> {pretty_amount(this.props.entity.utxo.amount)} </h4>
            <h3> Script</h3>
            <Hex className="txhex" readOnly value={this.props.entity.utxo.script.toString('hex')} />
            <h3>Spends</h3>
            <ListGroup variant="flush">
                {spends}
            </ListGroup>
        </div>);
    }
}
