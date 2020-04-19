import * as Bitcoin from 'bitcoinjs-lib';
import * as _ from 'lodash';
import { OutputLinkModel } from './DiagramComponents/OutputLink';
import { TransactionModel, PhantomTransactionModel } from './Transaction';
import { InputMap, TXIDAndWTXIDMap, TXID, txid_buf_to_string } from "./util";
import { UTXOModel } from "./UTXO";
import { number } from 'bitcoinjs-lib/types/script';
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
    link_models: Array<OutputLinkModel>
};

function preprocess_data(data: Data): PreProcessedData {
    let txns = data.program.map(k => Bitcoin.Transaction.fromHex(k.hex));
    let txn_labels = data.program.map(k => k.label);
    let txn_colors = data.program.map(k => new NodeColor(k.color));
    let utxo_labels = data.program.map(k => k.utxo_metadata);

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
    update: any,
    txn_labels: Array<string>,
    txn_colors: Array<NodeColor>,
    utxo_labels: Array<Array<UTXOFormatData | null>>): [TXIDAndWTXIDMap<TransactionModel>, Array<TransactionModel>] {
    let txid_map: TXIDAndWTXIDMap<TransactionModel> = new TXIDAndWTXIDMap();
    let txn_models: Array<TransactionModel> = [];
    _.chain(txns).map((t, idx)=>{return {tx:t,x:idx}}).groupBy(({tx}) => tx.getId()).forEach(
        (values, key) =>
        {
            let label = "";
            let color = new NodeColor("");
            let utxo_label : Array<UTXOFormatData|null>= [];
            let all_witnesses : Buffer[][][] = [];
            for (let {tx,x} of values) {
                utxo_label = utxo_labels[x];
                color = txn_colors[x];
                label = txn_labels[x];
                let witnesses : Buffer[][] = [];
                for (let input of tx.ins) {
                    witnesses.push(input.witness);
                }
                all_witnesses.push(witnesses);
            }
            let base_txn : Bitcoin.Transaction = values[0].tx.clone();
            // Clear out witness Data
            for (let input of base_txn.ins) {
                input.witness = [];
            }
            const txn_model = new TransactionModel(base_txn, all_witnesses, update,label, color, utxo_label);
            txid_map.add(txn_model);
            txn_models.push(txn_model);
        }
    ).value();
    let to_create : Map<TXID, Array<Bitcoin.TxInput>> = new Map();
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
        let n_outputs :number = 1+ _.chain(inps).map((el) => el.index).max().value();
        console.log("missing input", txid, n_outputs);
        for (let i = 0; i < n_outputs; ++i) {
            mock_txn.addOutput(new Buffer(""), 0);
        }
        const color = new NodeColor("white");
        const utxo_metadata : Array<UTXOFormatData|null> = new Array(n_outputs);
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
    : [Array<UTXOModel>, Array<OutputLinkModel>] {
    const to_add: Array<UTXOModel> = [];
    const to_add_links: Array<OutputLinkModel> = [];
    for (let m_txn of txn_models) {
        const txn = m_txn.tx;
        m_txn.utxo_models.forEach((utxo_model, output_index) => {
            const spenders: Array<TransactionModel> = inputs_map.get_txid_s(m_txn.get_txid(), output_index) ?? [];
            spenders.forEach((spender, spend_index) => {
                const spender_tx: Bitcoin.Transaction = spender.tx;
                const idx = spender_tx.ins.findIndex(elt => elt.index === output_index && elt.hash.toString('hex') === txn.getHash().toString('hex'));
                const link = utxo_model.addOutPort('spend ' + spend_index).link(spender.addInPort('input' + idx));
                spender.input_links.push(link);
                utxo_model.utxo.spends.push(spender);
                to_add.push(link);
            });
        });
        to_add.push(...m_txn.utxo_models);
        to_add_links.push(...m_txn.utxo_links);
    }
    return [to_add, to_add_links];
}
function process_data(update: any, obj: PreProcessedData): ProcessedData {
    let { txns, txn_colors, txn_labels, utxo_labels } = obj;
    let [txid_map, txn_models] = process_txn_models(txns, update, txn_labels, txn_colors, utxo_labels);
    let inputs_map = process_inputs_map(txn_models);

    const [to_add, to_add_links] = process_utxo_models(txn_models, inputs_map);
    return { inputs_map: inputs_map, utxo_models: to_add, txn_models: txn_models, txid_map: txid_map, link_models:to_add_links };
}

export class ContractBase {
    utxo_models: Array<UTXOModel>;
    link_models: Array<OutputLinkModel>;
    txn_models: Array<TransactionModel>;
    protected inputs_map: InputMap<TransactionModel>
    txid_map: TXIDAndWTXIDMap<TransactionModel>
    constructor() {
        this.utxo_models = [];
        this.inputs_map = new InputMap();
        this.txn_models = [];
        this.txid_map = new TXIDAndWTXIDMap();
        this.link_models = [];
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
    constructor(update_viewer: any, obj: Data);
    constructor(update_viewer?: any, obj?: Data) {
        super();
        if (update_viewer === undefined || obj === undefined)
            return;
        let new_obj = preprocess_data(obj);
        let { inputs_map, utxo_models, txn_models, txid_map, link_models } =
            process_data(update_viewer, new_obj);
        this.utxo_models = utxo_models;
        this.inputs_map = inputs_map;
        this.txn_models = txn_models;
        this.txid_map = txid_map;
        this.link_models = link_models;
        console.log(this);
    }
    // TODO: Return an Array of UTXOModels
    lookup(txid: Buffer, n: number): UTXOModel | null {
        let txid_s = txid_buf_to_string(txid);
        const txn_model : TransactionModel|undefined = this.txid_map.get_by_txid_s(txid_s);
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
}



