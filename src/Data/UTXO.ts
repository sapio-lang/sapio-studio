import { Transaction } from 'bitcoinjs-lib';
import {
    UTXOInnerData,
    UTXONodeModel,
} from '../UX/Diagram/DiagramComponents/UTXONode/UTXONodeModel';
import { TransactionModel } from './Transaction';
import { is_mock_outpoint, txid_buf_to_string } from '../util';
import { store } from '../Store/store';
import { select_utxo } from '../UX/Entity/EntitySlice';
import { UTXOFormatData } from '../common/preload_interface';
import { SpendLinkModel } from '../UX/Diagram/DiagramComponents/SpendLink/SpendLinkModel';
export function new_utxo_inner_data(
    script: Buffer,
    amount: number,
    txn: Transaction,
    index: number
): UTXOInnerData {
    return {
        txid: txn.getId(),
        index: index,
        script: script,
        amount: amount,
        spends: [],
    };
}
export class UTXOModel extends UTXONodeModel {
    constructor(
        utxo: UTXOInnerData,
        metadata: UTXOFormatData,
        txn: TransactionModel
    ) {
        super(
            {
                name: metadata.label,
                color: metadata.color,
                amount: utxo.amount,
                confirmed: false,
                txn,
                utxo,
                metadata,
            },
            txn.get_txid(),
            utxo.index
        );
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
        return this.getOptions().utxo.amount;
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
            utxo.getOptions().utxo.spends.forEach((spend: TransactionModel) => {
                spend.tx.ins
                    .filter(
                        (inp) =>
                            txid_buf_to_string(inp.hash) ===
                            utxo.getOptions().utxo.txid
                    )
                    .forEach((inp) => {
                        inp.hash = utxo.getOptions().txn.tx.getHash();
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
                        inp.hash = utxo.getOptions().txn.tx.getHash();
                        inp.index = utxo.getOptions().utxo.index;
                    });
                to_iterate.push(spend.utxo_models);
            });
        }
    }
}
