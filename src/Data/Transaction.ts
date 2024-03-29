import {
    DiagramModel,
    LinkModel,
    NodeModel,
} from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import { OutputLinkModel } from '../UX/Diagram/DiagramComponents/OutputLink';
import { SpendLinkModel } from '../UX/Diagram/DiagramComponents/SpendLink/SpendLinkModel';
import { TransactionNodeModel } from '../UX/Diagram/DiagramComponents/TransactionNode/TransactionNodeModel';
import { HasKeys, TXID } from '../util';
import { NodeColorT, SigningDataStore, NodeColor } from './ContractManager';
import './Transaction.css';
import { new_utxo_inner_data, UTXOModel } from './UTXO';
import { select_txn } from '../UX/Entity/EntitySlice';
import { store } from '../Store/store';
import { TransactionData, UTXOFormatData } from '../common/preload_interface';
import _ from 'lodash';

export class TransactionModel extends TransactionNodeModel implements HasKeys {
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
        this.tx = tx;
        this.utxo_models = [];
        this.utxo_links = [];
        this.input_links = [];
        this.witness_set = all_witnesses;
        for (let y = 0; y < this.tx.outs.length; ++y) {
            const subcolor = NodeColor.clone(color);
            const metadata: UTXOFormatData = _.merge(
                {
                    color: NodeColor.get(subcolor),
                    label: name,
                },
                utxo_labels[y]
            );
            // TODO: Get rid of assertion
            const out: Bitcoin.TxOutput = tx.outs[y] as Bitcoin.TxOutput;
            const utxo = new UTXOModel(
                new_utxo_inner_data(out.script, out.value, tx, y),
                metadata,
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
            output_metadata: this.utxo_models.map((u) => {
                return {
                    color: u.getOptions().color,
                    label: u.getOptions().name,
                    simp: {},
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
            model.removeNode(this as unknown as NodeModel);
            this.utxo_links.map((x) =>
                model.removeLink(x as unknown as LinkModel)
            );
        }
        this.utxo_models.map((x) => model.removeNode(x));
        this.input_links.map((x) =>
            model.removeLink(x as unknown as LinkModel)
        );
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
