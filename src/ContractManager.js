import { Transaction, TransactionModel } from './Transaction';
import { keyFn } from "./util";
import { hash_to_hex } from './Hex';
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
    let utxo_labels = data.program.map(k => k.utxo_metadata || []);

    return {txns: txns,  txn_colors: txn_colors, txn_labels:txn_labels, utxo_labels};
}

function process_inputs_map(txns, inputs_map) {
    for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        for (let y = 0; y < txn.ins.length; ++y) {
            const key = keyFn(txn.ins[y]);
            let arr = inputs_map.get(key) || [];
            arr.push(x);
            inputs_map.set(key, arr);
        }
    }
}

function process_txn_models(txns, txid_map, update, txn_labels, txn_colors, utxo_labels, txn_models) {
    for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        txid_map.set(txn.getTXID(), x);
        const txn_model = new TransactionModel(txn, update, txn_labels[x], txn_colors[x], utxo_labels[x]);
        txn_models.push(txn_model);
    }
}
function process_utxo_models(txns, txn_models, inputs_map, to_add) {
    for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        const len = txn.outs.length;
        for (let y = 0; y < len; ++y) {
            const utxo_model = txn_models[x].utxo_models[y];
            let key = keyFn({ hash: txns[x].getHash(), index: y });
            let idxs = inputs_map.get(key) || [];
            for (let z = 0; z < idxs.length; ++z) {
                const spender = txn_models[idxs[z]];
                const idx = spender.tx.ins.findIndex(elt => elt.index === y && elt.hash.toString('hex') === txn.getHash().toString('hex'));
                const link = utxo_model.addOutPort('spend ' + z).link(spender.addInPort('input' + idx));
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
                to_add.push(link);
            }
        }
        to_add.push(...txn_models[x].utxo_models);
        to_add.push(...txn_models[x].utxo_links);
    }
}
function process_data(update, obj) {
    let {txns, txn_colors, txn_labels, utxo_labels} =obj;
	let inputs_map = new Map();
	process_inputs_map(txns, inputs_map);

	let txid_map = new Map();
	let txn_models = [];
	process_txn_models(txns, txid_map, update, txn_labels, txn_colors, utxo_labels, txn_models);
	const to_add = [];
	process_utxo_models(txns, txn_models, inputs_map, to_add);
    return {inputs_map:inputs_map, utxo_models:to_add, txn_models:txn_models, txid_map:txid_map};
}

export class ContractBase {
    constructor() {
        this.utxo_models = [];
        this.inputs_map = new Map();
        this.txn_models = [];
        this.txid_map = new Map();
    }
    process_finality(is_final) {
        console.log("called empty")

    }
}
export class ContractModel extends ContractBase {
    constructor(update_viewer, obj) {
        super();
        this.obj = preprocess_data(obj);
        this.txns = this.obj.txns;
        let {inputs_map, utxo_models, txn_models, txid_map}=
            process_data(update_viewer, this.obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;

    }
    lookup(txid, n) {
        const idx = this.txid_map.get(hash_to_hex(txid));
        if (idx === undefined)
            return null;
        return this.txn_models[idx].utxo_models[n];
    }
    process_finality(is_final, model) {
        is_final.forEach((txid)=> {
            const m = this.txn_models[this.txid_map.get(txid)];
            m.setConfirmed(true);
            m.utxo_models.forEach((m)=> m.setConfirmed(true));
            m.consume_inputs(this.txn_models, this.inputs_map, this.txns, model);
        });
    }
}



