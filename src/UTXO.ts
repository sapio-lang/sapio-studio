import { Transaction } from 'bitcoinjs-lib';
import { UTXONodeModel } from './DiagramComponents/UTXONode/UTXONodeModel';
import { NodeColor } from './ContractManager';
import { TransactionModel } from './Transaction';
export class UTXOMetaData {
	txid: string;
	index: number;
	script: Buffer;
	amount: number;
	spends: Array<TransactionModel>;
	constructor(script: Buffer, amount:number, txn:Transaction, index:number) {
		this.txid = txn.getId();
		this.index = index;
		this.script = script;
		this.amount = amount;
        this.spends = [];
	}
}
export class UTXOModel extends UTXONodeModel {
	txn: TransactionModel;
	utxo: UTXOMetaData;
	type: string;
	constructor(utxo:UTXOMetaData, update:any, name:string, color:NodeColor, txn:TransactionModel) {
		super(name, color.get(), utxo.amount);
		this.utxo = utxo;
        this.txn = txn;
		this.registerListener({
			selectionChanged: update
		});
        this.type = "utxo";
	}
}

