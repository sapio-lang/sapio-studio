import * as Bitcoin from 'bitcoinjs-lib';
import { hash_to_hex } from './Hex';
import { TransactionModel } from './Transaction';
import { keyFn, OpaqueKey } from "./util";
import { UTXOModel } from "./UTXO";
import { OutputLinkModel } from './DiagramComponents/OutputLink';
export class NodeColor {
    c: string;
    constructor(c: string) {
        this.c = c;
    }
    get() {
        return this.c;
    }
    fade() {
    }
    clone() {
        return new NodeColor(this.c);
    }

}
export interface UTXOFormatData {
    color: string,
    label: string,
}
interface TransactionData {
    hex: string,
    color: string,
    label: string,
    utxo_metadata: Array<UTXOFormatData | null>
}

interface Data {
    program: Array<TransactionData>
}

interface PreProcessedData {
    txns: Array<Bitcoin.Transaction>,
    txn_colors: Array<NodeColor>,
    txn_labels: Array<string>,
    utxo_labels: Array<Array<UTXOFormatData | null>>,
};
interface ProcessedData {
    inputs_map: Map<OpaqueKey, Array<number>>,
    txid_map: Map<string, number>,
    txn_models: Array<TransactionModel>,
    utxo_models: Array<OutputLinkModel| UTXOModel>
};

function preprocess_data(data: Data): PreProcessedData {
    let txns = data.program.map(k => Bitcoin.Transaction.fromHex(k.hex));
    let txn_labels = data.program.map(k => k.label);
    let txn_colors = data.program.map(k => new NodeColor(k.color));
    let utxo_labels = data.program.map(k => k.utxo_metadata);

    return { txns: txns, txn_colors: txn_colors, txn_labels: txn_labels, utxo_labels };
}

function process_inputs_map(txns: Array<Bitcoin.Transaction>): Map<OpaqueKey, Array<number>> {
    const inputs_map = new Map();
    for (let x = 0; x < txns.length; ++x) {
        const txn: Bitcoin.Transaction = txns[x];
        for (let y = 0; y < txn.ins.length; ++y) {
            const inp: Bitcoin.TxInput = txn.ins[y];
            const key = keyFn(inp);
            let arr = inputs_map.get(key) ?? new Array();
            arr.push(x);
            inputs_map.set(key, arr);
        }
    }
    return inputs_map;
}

function process_txn_models(txns: Array<Bitcoin.Transaction>,
    update: any,
    txn_labels: Array<string>,
    txn_colors: Array<NodeColor>,
    utxo_labels: Array<Array<UTXOFormatData | null>>): [Map<string, number>, Array<TransactionModel>] {
    let txid_map = new Map();
    let txn_models: Array<TransactionModel> = [];
    for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        txid_map.set(txn.getId(), x);
        const txn_model = new TransactionModel(txn, update, txn_labels[x], txn_colors[x], utxo_labels[x]);
        txn_models.push(txn_model);
    }
    return [txid_map, txn_models];
}
function process_utxo_models(
    txns: Array<Bitcoin.Transaction>,
    txn_models: Array<TransactionModel>,
    inputs_map: Map<OpaqueKey, Array<number>>)
    : Array<OutputLinkModel | UTXOModel> {
    const to_add: Array<OutputLinkModel | UTXOModel> = [];
    for (let x = 0; x < txns.length; ++x) {
        const txn = txns[x];
        const len = txn.outs.length;
        for (let y = 0; y < len; ++y) {
            const utxo_model = txn_models[x].utxo_models[y];
            let key = keyFn({ hash: txns[x].getHash(), index: y });
            console.log(key);
            const idxs: Array<number> = inputs_map.get(key) ?? [];
            for (let z = 0; z < idxs.length; ++z) {
                const tx_idx: number = idxs[z];
                const spender = txn_models[tx_idx];
                const spender_tx: Bitcoin.Transaction = spender.tx;
                const idx = spender_tx.ins.findIndex(elt => elt.index === y && elt.hash.toString('hex') === txn.getHash().toString('hex'));
                const link = utxo_model.addOutPort('spend ' + z).link(spender.addInPort('input' + idx));
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
                to_add.push(link);
            }
        }
        to_add.push(...txn_models[x].utxo_models);
        to_add.push(...txn_models[x].utxo_links);
    }
    return to_add;
}
function process_data(update: any, obj: PreProcessedData) : ProcessedData {
    let { txns, txn_colors, txn_labels, utxo_labels } = obj;
    let inputs_map = process_inputs_map(txns);

    let [txid_map, txn_models] = process_txn_models(txns, update, txn_labels, txn_colors, utxo_labels);
    const to_add = process_utxo_models(txns, txn_models, inputs_map);
    return { inputs_map: inputs_map, utxo_models: to_add, txn_models: txn_models, txid_map: txid_map };
}

export class ContractBase {
    utxo_models: Array<UTXOModel|OutputLinkModel>;
    inputs_map: Map<OpaqueKey, Array<number>>;
    txn_models: Array<TransactionModel>;
    txid_map: Map<string, number>
    constructor() {
        this.utxo_models = [];
        this.inputs_map = new Map();
        this.txn_models = [];
        this.txid_map = new Map();
    }
    process_finality(is_final: Array<string>, model: any) {
        console.log("called empty");
    }

    lookup(txid: Buffer, n: number): UTXOModel|null {
        console.log("called empty");
        return null;
    }
}
export class ContractModel extends ContractBase {
    obj: PreProcessedData;
    txns: Array<Bitcoin.Transaction>;
    constructor(update_viewer: any, obj: Data) {
        super();
        this.obj = preprocess_data(obj);
        this.txns = this.obj.txns;
        let { inputs_map, utxo_models, txn_models, txid_map } =
            process_data(update_viewer, this.obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;
        console.log(this);
    }
    lookup(txid: Buffer, n: number): UTXOModel|null {
        const idx = this.txid_map.get(hash_to_hex(txid));
        if (idx === undefined)
            return null;
        return this.txn_models[idx].utxo_models[n];
    }
    process_finality(is_final: Array<string>, model: any) {
        is_final.forEach((txid) => {
            const key = this.txid_map.get(txid);
            if (key === undefined){ return; }
            const m = this.txn_models[key];
            m.setConfirmed(true);
            m.utxo_models.forEach((m) => m.setConfirmed(true));
            m.consume_inputs(this.txn_models, this.inputs_map, this.txns, model);
        });
    }
}



