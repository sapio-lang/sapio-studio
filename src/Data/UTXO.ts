import { Transaction } from 'bitcoinjs-lib';
import { ContractBase, NodeColor, NodeColorT } from './ContractManager';
import { UTXONodeModel } from '../UX/Diagram/DiagramComponents/UTXONode/UTXONodeModel';
import { ViewableEntityInterface } from '../UX/Entity/EntityViewer';
import { TransactionModel } from './Transaction';
import { is_mock_outpoint, txid_buf_to_string } from '../util';
import { SpendLinkModel } from '../UX/Diagram/DiagramComponents/SpendLink/SpendLinkModel';
import { store } from '../Store/store';
import { select_utxo } from '../UX/Entity/EntitySlice';
export class UTXOMetaData {
    index: number;
    script: Buffer;
    amount: number;
    spends: Array<TransactionModel>;
    txid: string;
    constructor(
        script: Buffer,
        amount: number,
        txn: Transaction,
        index: number
    ) {
        this.txid = txn.getId();
        this.index = index;
        this.script = script;
        this.amount = amount;
        this.spends = [];
    }
}
export class UTXOModel
    extends UTXONodeModel
    implements ViewableEntityInterface
{
    txn: TransactionModel;
    utxo: UTXOMetaData;
    constructor(
        utxo: UTXOMetaData,
        name: string,
        color: NodeColorT,
        txn: TransactionModel
    ) {
        super(
            {
                name,
                color: NodeColor.get(color),
                amount: utxo.amount,
                confirmed: false,
            },
            txn.get_txid(),
            utxo.index
        );
        this.utxo = utxo;
        this.txn = txn;
        this.registerListener({
            selectionChanged: (event: any) => {
                // TODO: get store the right way?
                if (event.isSelected)
                    store.dispatch(
                        select_utxo({ hash: utxo.txid, nIn: utxo.index })
                    );
            },
        });
    }
    getAmount(): number {
        return this.utxo.amount;
    }

    spent_by(
        spender: TransactionModel,
        s_idx: number,
        idx: number
    ): SpendLinkModel {
        return this.addOutPort('tx' + s_idx).spend_link(
            spender.addInPort('in' + idx, true),
            spender,
            undefined
        );
    }
}

export function update_utxomodel(utxo_in: UTXOModel) {
    const to_iterate: Array<UTXOModel>[] = [[utxo_in]];
    while (to_iterate.length) {
        const s = to_iterate.pop()!;
        for (const utxo of s) {
            // Pop a node for processing...
            utxo.utxo.spends.forEach((spend: TransactionModel) => {
                spend.tx.ins
                    .filter(
                        (inp) => txid_buf_to_string(inp.hash) === utxo.utxo.txid
                    )
                    .forEach((inp) => {
                        inp.hash = utxo.txn.tx.getHash();
                    });
                spend.tx.ins
                    .filter((inp) =>
                        is_mock_outpoint({
                            hash: txid_buf_to_string(inp.hash),
                            nIn: inp.index,
                        })
                    )
                    .forEach((inp) => {
                        // TODO: Only modify the mock that was intended
                        inp.hash = utxo.txn.tx.getHash();
                        inp.index = utxo.utxo.index;
                    });
                to_iterate.push(spend.utxo_models);
            });
        }
    }
}
