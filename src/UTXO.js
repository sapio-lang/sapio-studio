import { UTXONodeModel } from './DiagramComponents/UTXONode/UTXONodeModel';
export class UTXOMetaData {
	constructor(script, amount, txn, index) {
		this.txid = txn.getId();
		this.index = index;
		this.script = script;
		this.amount = amount;
        this.spends = [];
	}
}
export class UTXOModel extends UTXONodeModel {
	constructor(utxo, update, name, color, txn) {
		super(name, color.get(), utxo.amount);
		this.utxo = utxo;
        this.txn = txn;
		this.registerListener({
			selectionChanged: update
		});
        this.type = "utxo";
	}
}

