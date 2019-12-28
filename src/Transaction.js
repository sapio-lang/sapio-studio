
import { DefaultNodeModel } from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import Button from 'react-bootstrap/Button';

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
	}
}

class Hex extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (<code className="txhex" onClick={this.props.onClick}>{this.props.value} </code>)
    }
}
class Input extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
        const maybeDecode = (d, elt) => d ?
        Bitcoin.script.toASM(Bitcoin.script.decompile(elt)) : elt.toString('hex')
		const witness = this.props.txinput.witness.map((elt,i) =>
			<ListGroup.Item key={i}>
				<Row>
				<Col xs={1}>  </Col>
				<Col> <Hex readOnly className="txhex" value={maybeDecode(i === this.props.txinput.witness.length -1, elt)}></Hex>
				</Col>
				</Row>
			</ListGroup.Item>);
        const scriptValue = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txinput.script));;
        const script = this.props.txinput.script.length > 0 ?
                <ListGroup.Item>
                    <h4>Script</h4>
                    <Row>
                        <Col><Hex readOnly className="txhex" value={scriptValue}></Hex></Col>
                    </Row>
                </ListGroup.Item> : <ListGroup.Item> <h4> No Script </h4> </ListGroup.Item>;
		return(
			<ListGroup>
				<ListGroup.Item>
					<h4> OutPoint </h4>
					<Row>
						<Col><Hex readOnly className="txhex" value={this.props.txinput.hash.toString('hex')} /></Col>
						<Col xs={1}>{this.props.txinput.index}</Col>
					</Row>
                    <Row>
                    <Button onClick={this.props.update}> Go </Button>
                    </Row>
				</ListGroup.Item>
				<ListGroup.Item>
					<h4>Sequence</h4>
					<Row>
						<Col>
                            {this.props.txinput.sequence == Transaction.DEFAULT_SEQUENCE ? "Disabled" : this.props.txinput.sequence}
						</Col>
					</Row>
				</ListGroup.Item>
                {script}
				<ListGroup.Item>
					<h4>Witness</h4>
					<Row>
						<Col xs={12}>
							<ListGroup> {witness} </ListGroup>
						</Col>
					</Row>
				</ListGroup.Item>
			</ListGroup>
		);
	}
}

class Output extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
        const script = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txoutput.script));

		return(
			<div>
				<Row>
				<Col> {this.props.txoutput.value/100e6} BTC </Col>
				</Row>
				<Row>
				<Col> <Hex readOnly className="txhex" value={script}/></Col>
				</Row>
				<Row>
                <Button onClick={this.props.update}> Go </Button>
				</Row>
			</div>
		);
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
                <ListGroup.Item key={i}>
                    <Hex value={elt.tx.getTXID()}/>
                    <Button onClick={()=>this.props.update({entity: elt})}> Go</Button>
            </ListGroup.Item>);
		return(
			<div>
				<h2> UTXO </h2>
            <Button onClick={this.props.hide_details}>Hide</Button>
				<h3> Outpoint </h3>
				<Row>
					<Col> <Hex className="txhex" readOnly value={this.props.entity.utxo.txid.toString('hex')}/></Col>
					<Col xs={1}> {this.props.entity.utxo.index} </Col>
                    <Button onClick={()=>this.props.update({entity: this.props.entity.txn})}>Go</Button>
				</Row>
				<h3> Amount </h3>
				<Row>
					<Col> {this.props.entity.utxo.amount} </Col>
				</Row>
				<h3> Script</h3>
				<Row>
					<Col> <Hex className="txhex" readOnly value={this.props.entity.utxo.script.toString('hex')}/></Col>
				</Row>
				<h3>Spends</h3>
				<Row>
					<Col>
                        <ListGroup>
                            {spends}
                        </ListGroup>
                    </Col>
				</Row>
			</div>
		);
	}
}
Bitcoin.Transaction.prototype.getTXID = function() {
		return this.getHash().slice(0).reverse().toString('hex');

}
export class Transaction extends Bitcoin.Transaction {
	constructor() {
		super();
	}
}

export class TransactionModel extends DefaultNodeModel {
	constructor(tx, update, name, color) {
		super("txn "+ tx.getTXID().substr(0, 8) + " " + name, color.get());
		this.tx = tx;
        this.utxo_models = [];
        this.utxo_links = [];
        this.input_links = [];
        for (let y = 0; y < this.tx.outs.length; ++y) {
            const subcolor = color.clone();
            subcolor.fade();
            let utxo = new UTXOModel(new UTXO(tx.outs[y].script, tx.outs[y].value, tx, y), update, "utxo "+name + " " +tx.outs[y].value/100e6 + " BTC", subcolor, this);
            this.utxo_models.push(utxo);
            this.utxo_links.push(this.addOutPort('output ' + y).link(utxo.addInPort('create')));
        }
		this.registerListener({
			selectionChanged: update
		});
	}
    remove(model) {
        model.removeNode(this);
        this.utxo_models.map((x)=>model.removeNode(x));
        this.utxo_links.map((x)=>model.removeLink(x));
        this.input_links.map((x)=>model.removeLink(x));
    }
}

export class TransactionComponent extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
		if (!this.props.entity) return null;
		if (!this.props.entity.tx) return null;
		const outs = this.props.entity.tx.outs.map((o,i) =>
            <ListGroup.Item key={i}>
                <Output txoutput={o} update={() => this.props.update({entity: this.props.entity.utxo_models[i]})}/>
            </ListGroup.Item>);
		const ins = this.props.entity.tx.ins.map((o,i) =>
            <ListGroup.Item key={i}>
                <Input txinput={o} update={() => this.props.update({entity: this.props.find_tx_model(o.hash, o.index)})}/>
            </ListGroup.Item>);
		return (

            <div>
			<h2> Transaction </h2>
            <Button onClick={this.props.consume_inputs}>Broadcast</Button>
            <Button onClick={this.props.hide_details}>Hide</Button>
			<ListGroup>
			<ListGroup.Item>
			<Row>
				<Col xs={1}><h3> TXID</h3></Col>
			</Row>
			<Row >
			<Col> <Hex className="txhex" readOnly value={this.props.entity.tx.getTXID()}></Hex></Col>
			</Row>
			</ListGroup.Item>
			<ListGroup.Item>
				<h3> Inputs</h3>
				<Row> <Col xs={12}><ListGroup>{ins}</ListGroup></Col></Row>
			</ListGroup.Item>
			<ListGroup.Item>
				<h3>Outputs</h3>
				<Row>
					<Col xs={12}>
						<ListGroup>{outs}</ListGroup>
					</Col>
			</Row>
			</ListGroup.Item>
			<ListGroup.Item>
				<h3> Tx Hex </h3>
				<Row>
					<Col md={{ span: 10, offset: 1 }}>
						<Hex value= {this.props.entity.tx.toHex()} readOnly className="txhex"> </Hex>
					</Col>
				</Row>
			</ListGroup.Item>
			</ListGroup>
            </div>
		);
	}

}
