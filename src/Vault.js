import {Transaction, TransactionModel} from './Transaction';
import {hash_to_hex} from './Hex';
import {keyFn} from "./util";
import {SpendPortModel} from "./SpendLink";
export class NodeColor {
    constructor(c) {
        this.c = c;
    }
    get(){
        return this.c;
    }
    fade() {
    }
    clone() {
        return new NodeColor(this.c);
    }

}
function preprocess_data(data) {
    let txns = data.program.map(k => Transaction.fromHex(k.hex));
    let txn_labels = data.program.map(k => k.label);
    let txn_colors = data.program.map(k => new NodeColor(k.color));

    let labels_to_widths = new Map();
    labels_to_widths.set("create_tx", 50);
    labels_to_widths.set("vault_to_vault", 50);
    labels_to_widths.set("to_cold", 500);
    labels_to_widths.set("to_hot", 500);
    labels_to_widths.set("tree", 500);
    return {txns: txns, labels_to_widths: labels_to_widths, txn_colors: txn_colors, txn_labels:txn_labels};
}
function r2(update, obj) {
    let {txns, labels_to_widths, txn_colors, txn_labels} =obj;
	let inputs_map = new Map();
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
	for (let x = 0, count = 50; x < txns.length; ++x) {
		const txn = txns[x];
        txid_map.set(txn.getTXID(), x);
        const txn_model = new TransactionModel(txn, update, txn_labels[x], txn_colors[x]);
		txn_models.push(txn_model);
        const width = labels_to_widths.get(txn_labels[x]);
        const parent_hash = hash_to_hex(txn.ins[0].hash);
        const parent_idx = txid_map.get(parent_hash);
        if (parent_idx !== undefined) {
            const parent_pos = txn_models[parent_idx].getPosition();
        } else {
            count += 200;
        }

	}
	const to_add = [];
	for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        const len = txn.outs.length;
        const offset = Math.floor(len/4);
		for (let y = 0; y < len; ++y) {
            const utxo_model = txn_models[x].utxo_models[y];
			let key = keyFn({hash: txns[x].getHash(), index: y});
			let idxs = inputs_map.get(key) || [];

			for (let z = 0; z < idxs.length; ++z) {
				const spender = txn_models[idxs[z]];
                const idx = spender.tx.ins.findIndex(elt => elt.index === y && elt.hash.toString('hex') === txn.getHash().toString('hex'));
				const link = utxo_model.addPort(new SpendPortModel(true, 'spend '+z)).link(spender.addPort(new SpendPortModel(true, 'input '+idx)));
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
				to_add.push(link);
			}
		}
        to_add.push(...txn_models[x].utxo_models);
        to_add.push(...txn_models[x].utxo_links);
	}
    return {inputs_map:inputs_map, utxo_models:to_add, txn_models:txn_models, txid_map:txid_map};
}

export class VaultBase {
    constructor() {
        this.utxo_models = [];
        this.inputs_map = new Map();
        this.txn_models = [];
        this.txid_map = new Map();
    }
    load(){}
    unload() {}
    process_finality(is_final) {
        console.log("called empty")

    }
}
export class Vault extends VaultBase {
    constructor(update_viewer, obj) {
        super();
        this.obj = preprocess_data(obj);
        this.txns = this.obj.txns;
        let {inputs_map, utxo_models, txn_models, txid_map}=
            r2(update_viewer, this.obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;

    }
    load(model) {
        model.addAll(...this.txn_models);
        model.addAll(...this.utxo_models);
    }
    unload(model) {
        this.txn_models.forEach((m) => m.remove(model))
    }
    process_finality(is_final, model) {
        is_final.forEach((txid)=> {
            const m = this.txn_models[this.txid_map.get(txid)];
            m.setConfirmed(true);
            m.consume_inputs(this.txn_models, this.inputs_map, this.txns, model);
        });
    }
}
