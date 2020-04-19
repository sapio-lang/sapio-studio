import { Transaction } from 'bitcoinjs-lib';
import { NodeColor } from './ContractManager';
import { UTXONodeModel } from './DiagramComponents/UTXONode/UTXONodeModel';
import { Viewer } from './EntityViewer';
import { TransactionModel } from './Transaction';
export class UTXOMetaData {
	index: number;
	script: Buffer;
	amount: number;
	spends: Array<TransactionModel>;
	txid: string;
	constructor(script: Buffer, amount:number, txn:Transaction, index:number) {
		this.txid = txn.getId();
		this.index = index;
		this.script = script;
		this.amount = amount;
        this.spends = [];
	}
}
export class UTXOModel extends UTXONodeModel implements Viewer {
	txn: TransactionModel;
	utxo: UTXOMetaData;
	constructor(utxo:UTXOMetaData, update:any, name:string, color:NodeColor, txn:TransactionModel) {
		super({
			name,
			color:color.get(),
			value: utxo.amount,
			confirmed: false});
		this.utxo = utxo;
        this.txn = txn;
		this.registerListener({
			selectionChanged: update
		});
	}
}

