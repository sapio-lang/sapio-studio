import { Transaction } from "bitcoinjs-lib";

interface Key {
    index: number,
    hash: Buffer
}
export type OpaqueKey = string;
export function keyFn(key: Key): OpaqueKey {
    return key.hash.toString('hex') + ',' + key.index;
}
export function pretty_amount(amount: number) {
    if (amount > 1000) {
        return (amount / 100_000_000) + " BTC";
    } else {
        return (amount) + " Sats";
    }
}

// identifier which is stable with different witnesses
export function get_wtxid_backwards(tx: Transaction) {
    return tx.getHash(true).toString('hex');
}

export type WTXID = string;
export type TXID = string;
export interface HasKeys {
    get_wtxid: () => WTXID;
    get_txid: () => TXID;
}
export class TXIDAndWTXIDMap<K extends HasKeys>  {
    map: Map<WTXID, K>;
    map2: Map<TXID, Set<WTXID>>;
    constructor() {
        this.map = new Map();
        this.map2 = new Map();
    }
    add(t: K): void {
        this.map.set(t.get_wtxid(), t);
        let set = this.map2.get(t.get_txid()) ?? new Set();
        set.add(t.get_wtxid());
    }
    get_by_txid(t: K): Set<WTXID> | undefined {
        return this.map2.get(t.get_txid());
    }
    get_by_wtxid(t: K): K | undefined {
        return this.map.get(t.get_wtxid());
    }
    delete_by_txid(t: K) {
        this.get_by_txid(t)?.forEach(
            (x) => this.map.delete(t.get_wtxid())
        );
    }
    has_by_txid(t: TXID): boolean {
        return this.map2.has(t);
    }
    has_by_wtxid(t: K): boolean {
        return this.map2.has(t.get_txid());
    }

}