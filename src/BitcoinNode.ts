import { Input } from 'bitcoinjs-lib/types/transaction';
import App from './App';
import { hash_to_hex } from './Hex';
import { call } from './util';
type TXID = string;
export class BitcoinNodeManager {
    app : App;
    confirmed_txs : Set<TXID>;
    constructor(app: App) {
        this.app = app;
        this.confirmed_txs = new Set();
        this.periodic_check();
    }
    async periodic_check() {
        const is_tx_confirmed = await this.check_txs();
        if (is_tx_confirmed.length > 0) {
            is_tx_confirmed.forEach((txid :TXID ) => this.confirmed_txs.add(txid));
            this.update_broadcastable();
            this.app.current_contract.process_finality(is_tx_confirmed, this.app.model);
            this.app.forceUpdate();
        }
        setTimeout(this.periodic_check.bind(this), 1000);
    }
    update_broadcastable() {
        this.app.current_contract.txn_models
            .forEach((tm) => {
                const already_confirmed = this.confirmed_txs.has(tm.tx.getId());
                const inputs_not_locals = tm.tx.ins.every((inp: Input) => !this.app.current_contract.txid_map.has(hash_to_hex(inp.hash)));
                const all_inputs_confirmed = tm.tx.ins.every((inp: Input) => this.confirmed_txs.has(hash_to_hex(inp.hash)));
                if (already_confirmed) {
                    tm.set_broadcastable(false);
                }
                else if (inputs_not_locals) {
                    tm.set_broadcastable(true);
                }
                else if (all_inputs_confirmed) {
                    tm.set_broadcastable(true);
                }
                else {
                    tm.set_broadcastable(false);
                }
            });
    }
    async check_txs() : Promise<Array<TXID>> {
        const txids = this.app.current_contract.txn_models
            .filter((tm) => tm.is_broadcastable())
            .map((tm) => tm.tx.getId());
        if (txids.length > 0)
            return await call("/backend/get_transactions", txids);
        return [];
    }
}

