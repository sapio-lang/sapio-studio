import { Transaction } from 'bitcoinjs-lib';
import { NodeColor, NodeColorT } from './ContractManager';
import { UTXONodeModel } from '../UX/Diagram/DiagramComponents/UTXONode/UTXONodeModel';
import { ViewableEntityInterface } from '../UX/Entity/EntityViewer';
import { TransactionModel } from './Transaction';
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
    implements ViewableEntityInterface {
    txn: TransactionModel;
    utxo: UTXOMetaData;
    constructor(
        utxo: UTXOMetaData,
        update: any,
        name: string,
        color: NodeColorT,
        txn: TransactionModel
    ) {
        super({
            name,
            color: NodeColor.get(color),
            amount: utxo.amount,
            confirmed: false,
        });
        this.utxo = utxo;
        this.txn = txn;
        this.registerListener({
            selectionChanged: update,
        });
    }
    getAmount(): number {
        return this.utxo.amount;
    }
}
