
import { DefaultNodeModel } from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import Button from 'react-bootstrap/Button';
import Collapse from 'react-bootstrap/Collapse';
import Hex from './Hex';
export class UTXO {
	constructor(script, amount, txn, index) {
		this.txid = txn.getTXID();
		this.index = index;
		this.script = script;
		this.amount = amount;
        this.spends = [];
	}
}
export class UTXOModel extends DefaultNodeModel {
	constructor(utxo, update, name, color, txn) {
		super(name, color.get());
		this.utxo = utxo;
        this.txn = txn;
		this.registerListener({
			selectionChanged: update
		});
        this.type = "utxo";
	}
}
export class UTXOComponent extends React.Component  {

	constructor(props) {
		super(props);
	}
	render() {
		if (!this.props.entity) return null;
		if (!this.props.entity.utxo) return null;
        const spends = this.props.entity.utxo.spends.map((elt, i) =>
                <>
                <ListGroup.Item key={i}>
                    <Hex value={elt.tx.getTXID()}/>
                </ListGroup.Item>
                <ListGroup.Item action variant="primary" onClick={()=>this.props.update({entity: elt})}> Go</ListGroup.Item>
                </>
        );
		return(
			<div>
				<h2> UTXO </h2>
            <ListGroup >
                <ListGroup.Item action variant="secondary" onClick={this.props.hide_details}>Hide</ListGroup.Item>
            </ListGroup>
				<h3> Outpoint </h3>
                    <h4>Hash</h4>
					<Hex className="txhex" readOnly value={this.props.entity.utxo.txid.toString('hex')}/>
					<h4>N: {this.props.entity.utxo.index}</h4>
            <ListGroup >
                <ListGroup.Item action variant="primary" onClick={()=>this.props.update({entity: this.props.entity.txn})}>Go</ListGroup.Item>
            </ListGroup>
				<h3> Amount </h3>
					<h4> {this.props.entity.utxo.amount/100e6} BTC</h4>
				<h3> Script</h3>
					<Hex className="txhex" readOnly value={this.props.entity.utxo.script.toString('hex')}/>
				<h3>Spends</h3>
                <ListGroup variant="flush">
                {spends}
                </ListGroup>
			</div>
		);
	}
}
