import { Transaction } from 'bitcoinjs-lib';
import { UTXONodeModel } from '../UX/Diagram/DiagramComponents/UTXONode/UTXONodeModel';
import { TransactionModel } from './Transaction';
import { is_mock_outpoint, txid_buf_to_string } from '../util';
import { store } from '../Store/store';
import { select_utxo } from '../UX/Entity/EntitySlice';
import { UTXOFormatData } from '../common/preload_interface';
import { SpendLinkModel } from '../UX/Diagram/DiagramComponents/SpendLink/SpendLinkModel';
export type UTXOInnerData = {
    index: number;
    script: Buffer;
    amount: number;
    spends: Array<TransactionModel>;
    txid: string;
};
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
    txn: TransactionModel;
    utxo: UTXOInnerData;
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
