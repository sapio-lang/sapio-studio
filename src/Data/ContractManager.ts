import * as Bitcoin from 'bitcoinjs-lib';
import _, { Collection } from 'lodash';
import { SelectedEvent } from '../App';
import { InputMap, TXID, TXIDAndWTXIDMap, txid_buf_to_string } from "../util";
import { PhantomTransactionModel, TransactionModel } from './Transaction';
import { UTXOModel } from "./UTXO";
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
export interface TransactionData {
    hex: string,
    color?: string,
    label?: string,
    utxo_metadata?: Array<UTXOFormatData | null>
}

export interface Data {
    program: Array<TransactionData>
}

interface PreProcessedData {
    txns: Array<Bitcoin.Transaction>,
    txn_colors: Array<NodeColor>,
    txn_labels: Array<string>,
    utxo_labels: Array<Array<UTXOFormatData | null>>,
};
interface ProcessedData {
    inputs_map: InputMap<TransactionModel>,
    txid_map: TXIDAndWTXIDMap<TransactionModel>,
    txn_models: Array<TransactionModel>,
    utxo_models: Array<UTXOModel>
};

function preprocess_data(data: Data): PreProcessedData {
    let txns = data.program.map(k => Bitcoin.Transaction.fromHex(k.hex));
    let txn_labels = data.program.map(k => k.label??"unlabeled");
    let txn_colors = data.program.map(k => new NodeColor(k.color??"orange"));
    let utxo_labels = data.program.map((k, i) => k.utxo_metadata??new Array(txns[i].outs.length));

    return { txns: txns, txn_colors: txn_colors, txn_labels: txn_labels, utxo_labels };
}

function process_inputs_map(txns: Array<TransactionModel>): InputMap<TransactionModel> {
    const inputs_map: InputMap<TransactionModel> = new InputMap();
    for (let x = 0; x < txns.length; ++x) {
        const txn: Bitcoin.Transaction = txns[x].tx;
        for (let y = 0; y < txn.ins.length; ++y) {
            const inp: Bitcoin.TxInput = txn.ins[y];
            inputs_map.add(inp, txns[x]);
        }
    }
    return inputs_map;
}

function process_txn_models(txns: Array<Bitcoin.Transaction>,
    update: (s: SelectedEvent) => void,
    txn_labels: Array<string>,
    txn_colors: Array<NodeColor>,
    utxo_labels: Array<Array<UTXOFormatData | null>>): [TXIDAndWTXIDMap<TransactionModel>, Array<TransactionModel>] {
    let txid_map: TXIDAndWTXIDMap<TransactionModel> = new TXIDAndWTXIDMap();
    let txn_models: Array<TransactionModel> = [];
    _.chain(txns).map((t, idx) => { return { tx: t, x: idx } }).groupBy(({ tx }) => tx.getId()).forEach(
        (values, key) => {
            let label = "";
            let color = new NodeColor("");
            let utxo_label: Array<UTXOFormatData | null> = [];
            let all_witnesses: Buffer[][][] = [];
            for (let { tx, x } of values) {
                utxo_label = utxo_labels[x];
                color = txn_colors[x];
                label = txn_labels[x];
                let witnesses: Buffer[][] = [];
                for (let input of tx.ins) {
                    witnesses.push(input.witness);
                }
                all_witnesses.push(witnesses);
            }
            let base_txn: Bitcoin.Transaction = values[0].tx.clone();
            // Clear out witness Data
            for (let input of base_txn.ins) {
                input.witness = [];
            }
            const txn_model = new TransactionModel(base_txn, all_witnesses, update, label, color, utxo_label);
            txid_map.add(txn_model);
            txn_models.push(txn_model);
        }
    ).value();
    let to_create: Map<TXID, Array<Bitcoin.TxInput>> = new Map();
    for (const txn_model of txn_models) {
        for (const input of txn_model.tx.ins) {
            const txid = txid_buf_to_string(input.hash);
            if (txid_map.has_by_txid(txid)) {
                continue;
            }
            console.log("missing", txid);
            // Doesn't matter if already exists in array!
            // De Duplicated later...
            let inps = to_create.get(txid) || [];
            inps.push(input);
            to_create.set(txid, inps);
        }
    }
    console.log(to_create);
    to_create.forEach((inps, txid) => {
        const mock_txn = new Bitcoin.Transaction();
        let n_outputs: number = 1 + _.chain(inps).map((el) => el.index).max().value();
        console.log("missing input", txid, n_outputs);
        for (let i = 0; i < n_outputs; ++i) {
            mock_txn.addOutput(new Buffer(""), 0);
        }
        const color = new NodeColor("white");
        const utxo_metadata: Array<UTXOFormatData | null> = new Array(n_outputs);
        utxo_metadata.fill(null);
        const txn_model = new PhantomTransactionModel(txid, mock_txn, [], update, "Missing", color, utxo_metadata);
        txid_map.add(txn_model);
        txn_models.push(txn_model);
        console.log(txn_model);
    });

    return [txid_map, txn_models];
}
function process_utxo_models(
    txn_models: Array<TransactionModel>,
    inputs_map: InputMap<TransactionModel>)
    : Array<UTXOModel> {
    const to_add: Array<UTXOModel> = [];
    for (let m_txn of txn_models) {
        const txn = m_txn.tx;
        m_txn.utxo_models.forEach((utxo_model, output_index) => {
            const spenders: Array<TransactionModel> = inputs_map.get_txid_s(m_txn.get_txid(), output_index) ?? [];
            spenders.forEach((spender, spend_idx) => {
                const spender_tx: Bitcoin.Transaction = spender.tx;
                const idx = spender_tx.ins.findIndex(elt => elt.index === output_index && elt.hash.toString('hex') === txn.getHash().toString('hex'));
                const link = utxo_model.spent_by(spender, spend_idx, idx);
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
            });
        });
        to_add.push(...m_txn.utxo_models);
    }
    return to_add;
}
function process_data(update: (e: SelectedEvent) => void, obj: PreProcessedData): ProcessedData {
    let { txns, txn_colors, txn_labels, utxo_labels } = obj;
    let [txid_map, txn_models] = process_txn_models(txns, update, txn_labels, txn_colors, utxo_labels);
    let inputs_map = process_inputs_map(txn_models);

    const to_add = process_utxo_models(txn_models, inputs_map);
    return { inputs_map: inputs_map, utxo_models: to_add, txn_models: txn_models, txid_map: txid_map};
}

type TimingData = { unlock_time: number, unlock_height: number, unlock_at_relative_height: number, unlock_at_relative_time: number, txn: TransactionModel };
class TimingCache {
    // Array should be de-duplicated!
    cache: Map<TXID, [TimingData, Array<TransactionModel>|null]>;
    constructor(){
        this.cache = new Map();
    }
}
export const timing_cache = new TimingCache();

// In theory this just returns the PhantomTransactions, but in order to make it
// work with future changes compute rather than infer this list
function get_base_transactions(txns: Array<TransactionModel>, map: TXIDAndWTXIDMap<TransactionModel>): Array<TransactionModel> {
    let phantoms = txns.filter((item) => {
        return -1 === item.tx.ins.findIndex((inp) => map.has_by_txid(txid_buf_to_string(inp.hash)));
    });
    return phantoms;
}
// Based off of
// https://stackoverflow.com/a/41170834
function mergeAndDeduplicateSorted<T, T2>(array1:T[], array2:T[], iteratee: (t:T)=> T2 ) : Array<T> {
    const mergedArray = new Array(array1.length+array2.length);
    let i = 0;
    let j = 0;
    while (i < array1.length && j < array2.length) {
        if (iteratee(array1[i]) < iteratee(array2[j])) {
            mergedArray.push(array1[i]);
            i++;
        } else if (iteratee(array1[i]) > iteratee(array2[j])) {
            mergedArray.push(array2[j]);
            j++;
        } else {
            // Arbitrary
            mergedArray.push(array1[i]);
            i++;
            j++;
        }
    }
    if (i < array1.length) {
        for (let p = i; p < array1.length; p++) {
            mergedArray.push(array1[p]);
        }
    } else {
        for (let p = j; p < array2.length; p++) {
            mergedArray.push(array2[p]);
        }
    }
    return mergedArray;
};
function unreachable_by_time(bases: Array<TransactionModel>, max_time: number, max_height: number, start_height:number, start_time:number, map: InputMap<TransactionModel>):
    Array<TransactionModel> {
    // Every Array is Sorted and Unique, but *may* overlap
    const arrays =  bases.map((b) => unreachable_by_time_inner(b, max_time, max_height, start_height, start_time, map));
    // This algorithm is either O(# TransactionModels^2) because models can share descendants.
    // The alternative would be to call flat (O(n^2)) and then call sort...
    // The algorithm cannot be in place on the *first pass* because the arrays are from our cache
    // and shouldn't be modified.
    // Later passes could one day re-use allocations...
    while(arrays.length>1) {
        // Picks two random arrays to merge at a time to prevent adversarial cases...
        const v1 = Math.floor(Math.random() * arrays.length);
        let v2 = Math.floor(Math.random()*arrays.length);
        // Rejection sample for v2...
        while (v1 == v2) {
            v2 = Math.floor(Math.random() * arrays.length);
        }
        arrays[v1] = _(mergeAndDeduplicateSorted(arrays[v1], arrays[v2], (t:TransactionModel) => t.get_txid())).sortedUniqBy((t:TransactionModel) => t.get_txid()).value();
        const last = arrays.pop();
        if (last === undefined) throw Error("Invariant Broken on Array Length");
        if (arrays.length != v2) {
            arrays[v2] = last;
        }

    }
    return arrays.length > 0 ? arrays[0] : [];
}
function compute_timing(txn: TransactionModel) : TimingData {
    let cache_entry = timing_cache.cache.get(txn.get_txid())
    if (cache_entry) {
        return cache_entry[0];
    }
    const locktime = txn.tx.locktime;
    const sequences = txn.tx.ins.map((inp) => inp.sequence);
    // TODO: Handle MTP?
    let unlock_at_relative_height = 0;
    let unlock_at_relative_time = 0;
    let locktime_enabled = false;
    sequences.forEach((s) => {
        // Only enable locktime if at least one input is not UINT_MAX
        if (s === 0xFFFFFFFF) return;
        locktime_enabled = true;
        // skip, no meaning if set (except perhaps to enable locktime)
        if (s & 1 << 31) return;
        // Only bottom of sequence applies
        const s_mask = 0x00FFFF & s;
        if (s & (1 << 22)) {
            // Interpret as a relative time, units 512 seconds per s_mask
            unlock_at_relative_time = Math.max(s_mask * 512, unlock_at_relative_time);
        } else {
            // Interpret as a relative height, units blocks
            unlock_at_relative_height = Math.max(s_mask, unlock_at_relative_height);
        }
    });
    // before 500M, it is a height. After a UNIX time.
    const is_height = locktime < 500_000_000;
    let unlock_time = locktime_enabled && !is_height ? locktime : 0;
    let unlock_height = locktime_enabled && is_height ? locktime : 0;
    cache_entry= [{ unlock_time, unlock_height, unlock_at_relative_height, unlock_at_relative_time, txn }, null];
    timing_cache.cache.set(txn.get_txid(), cache_entry);
    return cache_entry[0];
}
function compute_timing_of_children(txn:TransactionModel, map:InputMap<TransactionModel>) : Collection<TimingData> {
    const spenders: Map<number, TransactionModel[]> = map.map.get(txn.get_txid()) ?? new Map();
    return _(Array.from(spenders.values())).flatMap((output_spender: TransactionModel[]) =>
        output_spender.map(compute_timing));

}



function unreachable_by_time_inner(base: TransactionModel, max_time: number, max_height: number, elapsed_time: number, elapsed_blocks: number, map: InputMap<TransactionModel>):
    Array<TransactionModel> {
    return compute_timing_of_children(base, map).value().flatMap(({unlock_time, unlock_height, unlock_at_relative_height, unlock_at_relative_time, txn}) =>{
            // The soonest time to satisfy both conditions
            const time_when_spendable = Math.max(unlock_time, elapsed_time+unlock_at_relative_time);
            const height_when_spendable = Math.max(unlock_height, elapsed_blocks+unlock_at_relative_height);
            // Return All Descendants and us from here because none of these transactions can go through
            // It is > because a block will accept ==
            if (time_when_spendable > max_time || height_when_spendable > max_height) {
                // TODO: Make this a Set type?
                return all_descendants(txn, map);
            }
            // Recurse with the new times
            return unreachable_by_time_inner(txn,
                max_time, max_height,
                time_when_spendable,
                height_when_spendable, map);
        });
}
function all_descendants(t: TransactionModel, inputs_map: InputMap<TransactionModel>) : Array<TransactionModel> {
    let cache_entry = timing_cache.cache.get(t.get_txid());
    if (cache_entry && cache_entry[1]) return cache_entry[1];
    // This case probably never happens...
    if (!cache_entry) {
        cache_entry = [compute_timing(t), null];
        timing_cache.cache.set(t.get_txid(), cache_entry);
    }
    cache_entry[1] = _(Array.from(inputs_map.map.get(t.get_txid())?.values()??[]).flat(1).map(
        (x) => all_descendants(x, inputs_map)
    ).flat(1)).uniqBy((t) => t.get_txid()).sortBy(t => t.get_txid()).value().concat(t);
    return cache_entry[1];
}


export class ContractBase {
    utxo_models: Array<UTXOModel>;
    txn_models: Array<TransactionModel>;
    protected inputs_map: InputMap<TransactionModel>
    txid_map: TXIDAndWTXIDMap<TransactionModel>
    constructor() {
        this.utxo_models = [];
        this.inputs_map = new InputMap();
        this.txn_models = [];
        this.txid_map = new TXIDAndWTXIDMap();
    }
    process_finality(is_final: Array<string>, model: any) {
        console.log("called empty");
    }

    lookup(txid: Buffer, n: number): UTXOModel | null {
        console.log("called empty");
        return null;
    }
}

export class ContractModel extends ContractBase {
    constructor();
    constructor(update_viewer: (e: SelectedEvent) => void, obj: Data);
    constructor(update_viewer?: any, obj?: Data) {
        super();
        if (update_viewer === undefined || obj === undefined)
            return;
        let new_obj = preprocess_data(obj);
        let { inputs_map, utxo_models, txn_models, txid_map } =
            process_data(update_viewer, new_obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;
        console.log(this);
    }
    // TODO: Return an Array of UTXOModels
    lookup(txid: Buffer, n: number): UTXOModel | null {
        let txid_s = txid_buf_to_string(txid);
        const txn_model: TransactionModel | undefined = this.txid_map.get_by_txid_s(txid_s);
        if (!txn_model) return null;
        return txn_model.utxo_models[n];
    }
    process_finality(is_final: Array<string>, model: any) {
        return null;
        // TODO: Reimplement in terms of WTXID
        /*is_final.forEach((txid) => {
            const key = this.txid_map.get(txid);
            if (key === undefined){ return; }
            const m = this.txn_models[key];
            m.setConfirmed(true);
            m.utxo_models.forEach((m) => m.setConfirmed(true));
            m.consume_inputs(this.txn_models, this.inputs_map, this.txns, model);
        });*/
    }
    reachable_at_time(max_time : number, max_height : number, start_time: number, start_height: number) : Array<TransactionModel> {
        const bases = get_base_transactions(this.txn_models, this.txid_map);
        return unreachable_by_time(bases, max_time, max_height, start_time, start_height, this.inputs_map);
    }
}



