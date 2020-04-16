
import * as Bitcoin from 'bitcoinjs-lib';
import { NodeColor } from './ContractManager';
import { TransactionNodeModel } from './DiagramComponents/TransactionNode/TransactionNodeModel';
import './Transaction.css';
import { call, keyFn } from './util';
import { UTXOMetaData, UTXOModel } from './UTXO';


export class TransactionModel extends TransactionNodeModel {
	constructor(tx, update, name, color, utxo_labels) {
		super(tx.getId().substr(0, 16), name, color.get());
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
            let metadata  = utxo_labels[y] || {color: subcolor.get(), label:  name };
            let utxo = new UTXOModel(new UTXOMetaData(tx.outs[y].script, tx.outs[y].value, tx, y), update, metadata.label, new NodeColor(metadata.color), this);
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


