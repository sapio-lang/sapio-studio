
import { DiagramModel, LinkModel } from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import { OutputLinkModel } from '../DiagramComponents/OutputLink';
import { SpendLinkModel } from '../DiagramComponents/SpendLink/SpendLinkModel';
import { TransactionNodeModel } from '../DiagramComponents/TransactionNode/TransactionNodeModel';
import { HasKeys, InputMap, TXID } from '../util';
import { Viewer } from '../UX/EntityViewer';
import { NodeColor, UTXOFormatData } from './ContractManager';
import './Transaction.css';
import { UTXOMetaData, UTXOModel } from './UTXO';


export class TransactionModel extends TransactionNodeModel implements Viewer, HasKeys {
    broadcastable: boolean;
    broadcastable_hook: (b: boolean) => void;
    tx: Bitcoin.Transaction;
    witness_set: Array<Array<Buffer[]>>;

    utxo_models: Array<UTXOModel>;
    public utxo_links: Array<OutputLinkModel>;
    public input_links: Array<SpendLinkModel>;
    constructor(tx: Bitcoin.Transaction, all_witnesses: Buffer[][][], update: any, name: string, color: NodeColor, utxo_labels: Array<UTXOFormatData | null>) {
        super(tx.getId().substr(0, 16), name, color.get());
        this.broadcastable = false;
        this.broadcastable_hook = (b) => { };
        this.tx = tx;
        this.utxo_models = [];
        this.utxo_links = [];
        this.input_links = [];
        this.witness_set = all_witnesses;
        for (let y = 0; y < this.tx.outs.length; ++y) {
            const subcolor = color.clone();
            subcolor.fade();
            let metadata = utxo_labels[y] || { color: subcolor.get(), label: name };
            // TODO: Get rid of assertion
            const out: Bitcoin.TxOutput = <Bitcoin.TxOutput>tx.outs[y];
            let utxo = new UTXOModel(new UTXOMetaData(out.script, out.value, tx, y), update, metadata.label, new NodeColor(metadata.color), this);
            this.utxo_models.push(utxo);
            this.utxo_links.push(this.addOutPort('output ' + y).link(utxo.addInPort('create')));
        }
        this.registerListener({
            selectionChanged: update
        });
    }

    setReachable(b:boolean) {
        // Turns on/off the widget banner
        super.setReachable(b);
        //  Turns off the outputs animinations
        for(const utxo_model of this.utxo_models) {
            utxo_model.setReachable(b);
        }
        // Turns off the inputs animations
        for(const input_link of this.input_links) {
            input_link.setReachable(b);
        }
    }
    get_txid(): TXID {
        return this.tx.getId();
    }
    remove_from_model(model: DiagramModel) {
        model.removeNode(this);
        this.utxo_models.map((x) => model.removeNode(x));
        this.utxo_links.map((x) => model.removeLink(<LinkModel><unknown>x));
        this.input_links.map((x) => model.removeLink(<LinkModel><unknown>x));
    }
    is_broadcastable() {
        return this.broadcastable;
    }
    set_broadcastable(b = true) {
        if (b !== this.broadcastable)
            this.broadcastable_hook(b);
        this.broadcastable = b;
    }
    set_broadcastable_hook(hook = (b: boolean) => { }) {
        this.broadcastable_hook = hook;
    }

    consume_inputs(inputs_map: InputMap<TransactionModel>, model: any) {
        const to_clear: Array<TransactionModel> = [];
        this.tx.ins.forEach((inp) => {
            const to_prune = inputs_map.get(inp) || [];
            to_prune.forEach((txn_model) => {
                if (txn_model.tx !== this.tx) {
                    txn_model.remove_from_model(model);
                    to_clear.push(txn_model);
                }
            });
        });
        while (to_clear.length) {
            const mtx = <TransactionModel>to_clear.pop();
            const tx = mtx.tx;
            // now remove children
            for (let i = 0; i < tx.outs.length; ++i) {
                const to_prune: Array<TransactionModel> | undefined = inputs_map.get({ hash: tx.getHash(), index: i });
                if (to_prune) {
                    to_prune.forEach((txn_model) => txn_model.remove_from_model(model));
                    to_clear.push(...to_prune);
                }
            }
        }
    }
}


export class PhantomTransactionModel extends TransactionModel {
    override_txid : TXID;
    constructor(override_txid: TXID, tx: Bitcoin.Transaction, all_witnesses: Buffer[][][], update: any, name: string, color: NodeColor, utxo_labels: Array<UTXOFormatData | null>) {
        super(tx, all_witnesses, update, name, color, utxo_labels);
        this.override_txid = override_txid;

    }
    get_txid() : TXID {
        return this.override_txid;
    }
}