import React from 'react';
import './App.css';
import * as Bitcoin from 'bitcoinjs-lib';

import createEngine, { DiagramModel, DefaultNodeModel, RightAngleLinkFactory, DefaultPortModel,
	LinkModel,
	RightAngleLinkModel
 } from '@projectstorm/react-diagrams';
import { AbstractModelFactory, CanvasWidget } from '@projectstorm/react-canvas-core';
import { DemoCanvasWidget } from './DemoCanvasWidget.tsx';
import {data} from './Data.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import ListGroup from 'react-bootstrap/ListGroup';
import {Transaction, TransactionModel, TransactionComponent, UTXOModel, UTXO, UTXOComponent} from './Transaction';
import Button from 'react-bootstrap/Button';

const keyFn = (key) => key.hash.toString('hex') +','+ key.index;
function pre_procsess() {

}
class NodeColor {
    constructor(r,g,b,a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a || 0.5;
    }
    get(){
        return "rgba("+[this.r,this.b,this.g,this.a].join(',')+")";
    }
    fade() {
        this.a *= 0.25;
    }
    clone() {
        return new NodeColor(this.r, this.g, this.b, this.a);
    }

}
/* Allow individuals to fade */
const BLACK = () => new  NodeColor(0,0,0);
const BLUE  = () => new  NodeColor(0,255, 0);
const GREEN = () => new  NodeColor(0,0,255);
const RED   = () => new  NodeColor(255,0,0);
function preprocess_data() {
	let txns = [Transaction.fromHex(data['metadata']['create_tx'])];
	let txn_labels =["create_vault"];
	let txn_colors =[BLACK()];
	let walk = data;
    let labels_to_widths = new Map();
    labels_to_widths.set("create_vault", 0);
    labels_to_widths.set("to_vault", 400);
    labels_to_widths.set("to_cold", 800);
    labels_to_widths.set("to_hot", 800);
	while (walk["step"]) {
		txns.push(Transaction.fromHex(walk["step"]));
		txn_labels.push("to_vault");
		txn_colors.push(GREEN());
		if (walk["children"] && walk["children"]["withdrawal"]) {
			txns.push(Transaction.fromHex(walk["children"]["withdrawal"]["to_cold"]));
			txn_labels.push("to_cold");
            txn_colors.push(BLUE());
			txns.push(Transaction.fromHex(walk["children"]["withdrawal"]["to_hot"]));
			txn_labels.push("to_hot");
            txn_colors.push(RED());
		}
		const have_next = walk["children"] && walk["children"]["sub_vault"];
		if (have_next) {
			txns.push(Transaction.fromHex(walk["children"]["sub_vault"]["to_cold"]));
			txn_labels.push("to_cold");
            txn_colors.push(BLUE());
			walk = walk["children"]["sub_vault"]["next"]
		} else {
			break;
		}
	}
    return {txns: txns, labels_to_widths: labels_to_widths, txn_colors: txn_colors, txn_labels:txn_labels};
}
function r2(model, update, obj) {
    let {txns: txns, labels_to_widths: labels_to_widths, txn_colors: txn_colors, txn_labels:txn_labels} =obj;
	let inputs_map = new Map();
    let outputs_map = new Map();
	for (let x = 0; x < txns.length; ++x) {
		const txn = txns[x];
		for (let y = 0; y < txn.ins.length; ++y) {
			const key = keyFn(txn.ins[y]);
			let arr = inputs_map.get(key) || [];
			arr.push(x);
			inputs_map.set(key, arr);
		}
	}

	let txid_map = new Map();
	let txn_models = [];
	for (let x = 0, count = 0; x < txns.length; ++x) {
		const txn = txns[x];
        txid_map.set(txn.getHash().toString('hex'), x);
        const txn_model = new TransactionModel(txn, update, txn_labels[x], txn_colors[x]);
		txn_models.push(txn_model);
        const width = labels_to_widths.get(txn_labels[x]);
        let parent_idx = txid_map.get(txn.ins[0].hash.toString('hex'));
        if (parent_idx) {
            const parent_pos = txn_models[parent_idx].getPosition();
            txn_models[x].setPosition(width, parent_pos.y+
                300*txn.ins[0].index+
                100*( (inputs_map.get(keyFn(txn.ins[0])) || []
            ).indexOf(x)));
        } else {
            txn_models[x].setPosition(width, count);
            count += 100;
        }

	}
	const to_add = [];
	for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        const len = txn.outs.length;
        const offset = Math.floor(len/4);
		for (let y = 0; y < len; ++y) {
            const utxo_model = txn_models[x].utxo_models[y];
			utxo_model.setPosition(txn_models[x].getPosition().x + 200, txn_models[x].getPosition().y + (y-offset)*100);
			let key = keyFn({hash: txns[x].getHash(), index: y});
			let idxs = inputs_map.get(key) || [];

			for (let z = 0; z < idxs.length; ++z) {
				const spender = txn_models[idxs[z]];
                const idx = spender.tx.ins.findIndex(elt => elt.index === y && elt.hash.toString('hex') === txn.getHash().toString('hex'));
				const link = utxo_model.addOutPort('spend '+z).link(spender.addInPort('input '+idx));
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
				to_add.push(link);
			}
		}
        to_add.push(...txn_models[x].utxo_models);
        to_add.push(...txn_models[x].utxo_links);
	}
	model.addAll(...txn_models);
	model.addAll(...to_add);
    return {inputs_map:inputs_map, utxo_models:to_add, txn_models:txn_models, txid_map:txid_map};
}

class App extends React.Component {
    constructor(props) {
        super(props);
        this.obj = preprocess_data();
        this.txns = this.obj.txns;
        this.state = {};
        this.state.entity = null;
        this.state.details = false;
        this.engine = createEngine();
        this.engine.getLinkFactories().registerFactory(new RightAngleLinkFactory());
        this.model = new DiagramModel();
        this.model.setGridSize(50);

        var walk = data;
        let {inputs_map:inputs_map, utxo_models:utxo_models, txn_models:txn_models, txid_map:txid_map}=
            r2(this.model,this.update_viewer.bind(this), this.obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;
        this.model.setLocked(true);
        this.engine.setModel(this.model);
    }



    update_viewer (data) {
        console.log(data);
        if (data.isSelected === false || data.entity === null) {
            this.setState({details:false});
        } else if (data.entity) {
            this.setState({entity:data.entity, details:true});
        }
    }
    consume_inputs() {

        const to_clear = [];
        for (let i = 0; i < this.state.tx.ins.length; ++i) {
            const inp = this.state.tx.ins[i];
            const key = keyFn(inp);
            const to_prune = this.inputs_map.get(key);
            to_prune.map((i)=> {
                if (this.txn_models[i].tx !== this.state.tx) {
                    this.txn_models[i].remove(this.model);
                    to_clear.push(this.txn_models[i].tx);
                }
            });
        }
        while (to_clear.length) {
            const tx = to_clear.pop();
            if (to_clear >100)
                throw "Error";
            // now remove children
            for (let i = 0; i < tx.outs.length; ++i) {
                const key = keyFn({hash: tx.getHash(), index:i});
                const to_prune = this.inputs_map.get(key);

                if (to_prune) {
                    to_prune.forEach((x)=> this.txn_models[x].remove(this.model));
                    to_clear.push(...to_prune.map((i) => this.txns[i]));
                }
            }
        }
        this.forceUpdate();

    }

    hide_details() {
        this.setState({details: false});
    }

	render() {
        const detail_view = !this.state.details? null :
                <Col  xs={6} sm={5} md={4} lg={3} xl={2}>
                    <TransactionComponent entity={this.state.entity}
                                          consume_inputs={this.consume_inputs.bind(this)}
                                          hide_details={this.hide_details.bind(this)}
                                          update={this.update_viewer.bind(this)}
                                          find_tx_model={(txid, n) => {
                                              const idx = this.txid_map.get(txid.toString('hex'));
                                              if (idx === undefined) return null;
                                              return this.txn_models[idx].utxo_models[n];
                                          }
                                          }
                    />
                    <UTXOComponent entity={this.state.entity}
                                   hide_details={this.hide_details.bind(this)}
                                   update={this.update_viewer.bind(this)}
                    />
                </Col>;
		return (
			<div className="App">
            <Row>
                <Col xs={this.state.details? 6: 12}
                     sm={this.state.details? 7: 12}
                     md={this.state.details? 8: 12}
                     lg={this.state.details? 9: 12}
                     xl={this.state.details? 10: 12}>
                    <DemoCanvasWidget>
                    <CanvasWidget engine={this.engine} key={"main"} />
                    </DemoCanvasWidget>
                </Col>
                {detail_view}
            </Row>
            </div>
		);
	}
}

export default App;

