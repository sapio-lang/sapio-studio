import {
    DiagramModel,
    LinkModel,
    NodeModel,
} from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import { OutputLinkModel } from '../UX/Diagram/DiagramComponents/OutputLink';
import { SpendLinkModel } from '../UX/Diagram/DiagramComponents/SpendLink/SpendLinkModel';
import { TransactionNodeModel } from '../UX/Diagram/DiagramComponents/TransactionNode/TransactionNodeModel';
import { HasKeys, InputMap, InputMapT, TXID } from '../util';
import { ViewableEntityInterface } from '../UX/Entity/EntityViewer';
import {
    NodeColorT,
    UTXOFormatData,
    SigningDataStore,
    NodeColor,
} from './ContractManager';
import './Transaction.css';
import { UTXOMetaData, UTXOModel } from './UTXO';
import { TransactionData } from './ContractManager';
import { select_txn } from '../UX/Entity/EntitySlice';
import { store } from '../Store/store';
import { SelectedEvent } from '../App';

export class TransactionModel
    extends TransactionNodeModel
    implements ViewableEntityInterface, HasKeys {
    broadcastable: boolean;
    broadcastable_hook: (b: boolean) => void;
    tx: Bitcoin.Transaction;
    witness_set: SigningDataStore;
    utxo_models: Array<UTXOModel>;
    public utxo_links: Array<OutputLinkModel>;
    public input_links: Array<SpendLinkModel>;
    constructor(
        tx: Bitcoin.Transaction,
        all_witnesses: SigningDataStore,
        name: string,
        color: NodeColorT,
        utxo_labels: Array<UTXOFormatData | null>
    ) {
        super({}, tx.getId().substr(0, 16), name, NodeColor.get(color), tx);
        this.broadcastable = false;
        this.broadcastable_hook = (b) => {};
        this.tx = tx;
        this.utxo_models = [];
        this.utxo_links = [];
        this.input_links = [];
        this.witness_set = all_witnesses;
        for (let y = 0; y < this.tx.outs.length; ++y) {
            const subcolor = NodeColor.clone(color);
            NodeColor.fade(subcolor);
            let metadata = utxo_labels[y] || {
                color: NodeColor.get(subcolor),
                label: name,
            };
            // TODO: Get rid of assertion
            const out: Bitcoin.TxOutput = tx.outs[y] as Bitcoin.TxOutput;
            let utxo = new UTXOModel(
                new UTXOMetaData(out.script, out.value, tx, y),
                metadata.label,
                NodeColor.new(metadata.color),
                this
            );
            this.utxo_models.push(utxo);
            this.utxo_links.push(
                this.addOutPort('out' + y, true).create_link(
                    utxo.addInPort('create'),
                    this,
                    undefined
                )
            );
        }
        this.registerListener({
            selectionChanged: (event: any): void => {
                if (event.isSelected) store.dispatch(select_txn(tx.getId()));
            },
        });
    }

    get_json(): TransactionData {
        return {
            psbt: this.witness_set.psbts[0]!.toBase64(),
            hex: this.tx.toHex(),
            metadata: {
                label: this.getOptions().name,
                color: this.getOptions().color,
            },
            utxo_metadata: this.utxo_models.map((u) => {
                return {
                    color: u.getOptions().color,
                    label: u.getOptions().name,
                };
            }),
        };
    }

    get_txid(): TXID {
        return this.tx.getId();
    }
    remove_from_model(model: DiagramModel) {
        if (!(this instanceof PhantomTransactionModel)) {
            // TODO: is this a valid cast
            model.removeNode((this as unknown) as NodeModel);
            this.utxo_links.map((x) =>
                model.removeLink((x as unknown) as LinkModel)
            );
        }
        this.utxo_models.map((x) => model.removeNode(x));
        this.input_links.map((x) =>
            model.removeLink((x as unknown) as LinkModel)
        );
    }
    is_broadcastable() {
        return this.broadcastable;
    }
    set_broadcastable(b = true) {
        if (b !== this.broadcastable) this.broadcastable_hook(b);
        this.broadcastable = b;
    }
    set_broadcastable_hook(hook = (b: boolean) => {}) {
        this.broadcastable_hook = hook;
    }

    consume_inputs(inputs_map: InputMapT<TransactionModel>, model: any) {
        const to_clear: Array<TransactionModel> = [];
        this.tx.ins.forEach((inp) => {
            const to_prune = InputMap.get(inputs_map, inp) || [];
            to_prune.forEach((txn_model) => {
                if (txn_model.tx !== this.tx) {
                    txn_model.remove_from_model(model);
                    to_clear.push(txn_model);
                }
            });
        });
        while (to_clear.length) {
            const mtx = to_clear.pop() as TransactionModel;
            const tx = mtx.tx;
            // now remove children
            for (let i = 0; i < tx.outs.length; ++i) {
                const to_prune: Array<TransactionModel> =
                    InputMap.get(inputs_map, {
                        hash: tx.getHash(),
                        index: i,
                    }) ?? [];
                to_prune.forEach((txn_model) =>
                    txn_model.remove_from_model(model)
                );
                to_clear.push(...to_prune);
            }
        }
    }
}

export class PhantomTransactionModel extends TransactionModel {
    override_txid: TXID;
    constructor(
        override_txid: TXID,
        tx: Bitcoin.Transaction,
        all_witnesses: SigningDataStore,
        name: string,
        color: NodeColorT,
        utxo_labels: Array<UTXOFormatData | null>
    ) {
        super(tx, all_witnesses, name, color, utxo_labels);
        this.override_txid = override_txid;
    }
    get_txid(): TXID {
        return this.override_txid;
    }
}
