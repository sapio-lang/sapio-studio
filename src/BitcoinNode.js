import { ContractModel } from './ContractManager';
import { call } from './util';
import { hash_to_hex } from './Hex';
export class BitcoinNodeManager {
    constructor(app) {
        this.app = app;
        this.confirmed_txs = new Set();
        this.periodic_check();
    }
    async periodic_check() {
        const is_tx_confirmed = await this.check_txs();
        if (is_tx_confirmed.length > 0) {
            is_tx_confirmed.forEach((txid) => this.confirmed_txs.add(txid));
            this.update_broadcastable();
            this.app.vault.process_finality(is_tx_confirmed, this.app.model);
            this.app.forceUpdate();
        }
        setTimeout(this.periodic_check.bind(this), 1000);
    }
    load_new_model(data) {
        let vault = new ContractModel(this.app.update_viewer.bind(this.app), data);
        this.app.vault.unload(this.app.model);
        vault.load(this.app.model);
        this.app.vault = vault;
        this.app.setState({ vault });
        this.update_broadcastable();
        this.app.forceUpdate();
        setTimeout(() => { this.app.redistribute(); this.app.engine.zoomToFit(); }, 100);
    }
    update_broadcastable() {
        this.app.vault.txn_models
            .forEach((tm) => {
                const already_confirmed = this.confirmed_txs.has(tm.tx.getTXID());
                const inputs_not_locals = tm.tx.ins.every((inp) => !this.app.vault.txid_map.has(hash_to_hex(inp.hash)));
                const all_inputs_confirmed = tm.tx.ins.every((inp) => this.confirmed_txs.has(hash_to_hex(inp.hash)));
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
    async check_txs() {
        const txids = this.app.vault.txn_models
            .filter((tm) => tm.is_broadcastable())
            .map((tm) => tm.tx.getTXID());
        if (txids.length > 0)
            return await call("/backend/get_transactions", txids);
        return [];
    }
}

