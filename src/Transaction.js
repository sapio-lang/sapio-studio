
import './Transaction.css';
import { CustomNodeModel } from './custom_node/CustomNodeModel';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Collapse from 'react-bootstrap/Collapse';

import Hex from './Hex';
import {call, keyFn} from './util';
import {hash_to_hex} from './Hex';
import {UTXOModel, UTXO } from './UTXO';
import {NodeColor } from './Vault';

class Input extends React.Component {
	constructor(props) {
		super(props);
        this.state = {};
        this.state.open =false;
        this.hash= hash_to_hex(this.props.txinput.hash);
	}
	render() {
        const maybeDecode = (d, elt) =>
            d ?  Bitcoin.script.toASM(Bitcoin.script.decompile(elt)) : elt.toString('hex');
		const witness = [];/*this.props.txinput.witness.map((elt,i) =>
            (<ListGroup.Item key={i}>
				<Hex readOnly className="txhex" value={maybeDecode(i === (this.props.txinput.witness.length -1), elt)}></Hex>
			</ListGroup.Item>)
        );*/
        const scriptValue = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txinput.script));;
        const script = this.props.txinput.script.length > 0 ?
            <>
            <h4>Script</h4>
            <Hex readOnly className="txhex" value={scriptValue}></Hex>
            </>: null;
        const sequence =  this.props.txinput.sequence === Transaction.DEFAULT_SEQUENCE ? null :
                        <h4>Sequence: {this.props.txinput.sequence} </h4>
                    ;
		return(
			<div>
					<h4> OutPoint </h4>
                    <h5>Hash</h5>
                    <Hex readOnly className="txhex" value={this.hash} />
                    <h5>N: {this.props.txinput.index} </h5>

                    <ListGroup horizontal>
                        <ListGroup.Item action variant="primary" onClick={this.props.update}>
                        Go
                        </ListGroup.Item>
                        <ListGroup.Item action variant="secondary" onClick={() => this.setState({open: !this.state.open})}
                        aria-controls="input-data"
                        aria-expanded={this.state.open}>
                            {this.state.open? "Less" : "More"}...
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
			</div>
		);
	}
}

class Output extends React.Component {
	render() {
        const script = Bitcoin.script.toASM(Bitcoin.script.decompile(this.props.txoutput.script));

		return(
			<>
				<h4> {this.props.txoutput.value/100e6} BTC </h4>
				<Hex readOnly className="txhex" value={script}/>
                <ListGroup>
                    <ListGroup.Item action variant="primary" onClick={this.props.update}> Go </ListGroup.Item>
                </ListGroup>
			</>
		);
	}
}

Bitcoin.Transaction.prototype.getTXID = function() {
    const b = new Buffer(32);
    this.getHash().copy(b);
    b.reverse();
    return b.toString('hex');
}
export class Transaction extends Bitcoin.Transaction {
}

export class TransactionModel extends CustomNodeModel {
	constructor(tx, update, name, color, utxo_labels) {
		super(tx.getTXID().substr(0, 16), name, color.get());
        this.type = "txn";
        this.broadcastable = false;
        this.broadcastable_hook = false;
		this.tx = tx;
        this.utxo_models = [];
        this.utxo_links = [];
        this.input_links = [];
        for (let y = 0; y < this.tx.outs.length; ++y) {
            const subcolor = color.clone();
            subcolor.fade();
            console.log(utxo_labels[y]);
            let metadata  = utxo_labels[y] || {color: subcolor.get(), label: "utxo " + name };
            let utxo = new UTXOModel(new UTXO(tx.outs[y].script, tx.outs[y].value, tx, y), update, metadata.label +" " +tx.outs[y].value/100e6 + " BTC", new NodeColor(metadata.color), this);
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
    broadcast() {
        call("submit_raw_transaction", [this.tx.toHex()]);
    }
    is_broadcastable() {
        return this.broadcastable;
    }
    set_broadcastable(b=true) {
        if (this.broadcastable_hook !== false && b !== this.broadcastable)
            this.broadcastable_hook(b);
        this.broadcastable = b;
    }
    set_broadcastable_hook(hook=false) {
        this.broadcastable_hook =hook;
    }

    consume_inputs(txn_models, inputs_map, txns, model) {
        const to_clear = [];
        this.tx.ins.forEach((inp) => {
            const key = keyFn(inp);
            const to_prune = inputs_map.get(key) || [];
            to_prune.forEach((i)=> {
                if (txn_models[i].tx !== this.tx) {
                    txn_models[i].remove(model);
                    to_clear.push(txn_models[i].tx);
                }
            });
        });
        while (to_clear.length) {
            const tx = to_clear.pop();
            // now remove children
            for (let i = 0; i < tx.outs.length; ++i) {
                const key = keyFn({hash: tx.getHash(), index:i});
                const to_prune = inputs_map.get(key);

                if (to_prune) {
                    to_prune.forEach((x)=> txn_models[x].remove(model));
                    to_clear.push(...to_prune.map((i) => txns[i]));
                }
            }
        }
    }
}

export class TransactionComponent extends React.Component {
	constructor(props) {
		super(props);
        this.state = {};
        this.state.broadcastable = this.props.entity.is_broadcastable();
        this.props.entity.set_broadcastable_hook((b) => this.setState({broadcastable: b}));
	}
    static getDerivedStateFromProps(props, state) {
        state.broadcastable = props.entity.is_broadcastable();
    }

	render() {
        const broadcast =
            this.state.broadcastable ? <ListGroup.Item action variant="primary" onClick={() => this.props.entity.broadcast()}>Broadcast</ListGroup.Item> : null;
		const outs = this.props.entity.tx.outs.map((o,i) =>
            <ListGroup.Item key={i}>
                <Output txoutput={o} update={() => this.props.update({entity: this.props.entity.utxo_models[i]})}/>
            </ListGroup.Item>);
		const ins = this.props.entity.tx.ins.map((o,i) =>
            <ListGroup.Item key="input-{i}">
                <Input txinput={o} update={() => this.props.update({entity: this.props.find_tx_model(o.hash, o.index)})}/>
            </ListGroup.Item>);
		return (

            <div>
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
                <Hex value= {this.props.entity.tx.toHex()} readOnly className="txhex"> </Hex>
			</ListGroup.Item>
			</ListGroup>
            </div>
		);
	}

}
