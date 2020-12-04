import { Transaction } from 'bitcoinjs-lib';

interface Key {
    index: number;
    hash: Buffer;
}
type OpaqueKey = string;

export function txid_buf_to_string(txid: Buffer): TXID {
    let copy = new Buffer(txid.length);
    txid.forEach((v, i) => {
        copy[txid.length - 1 - i] = v;
    });
    return copy.toString('hex');
}
// Maps an Input (TXID) to all Spenders
export class InputMap<T> {
    map: Map<OpaqueKey, Map<number, Array<T>>>;
    constructor() {
        this.map = new Map();
    }
    add(t: Key, model: T) {
        const key1 = txid_buf_to_string(t.hash);
        let vals = this.map.get(key1);
        if (vals === undefined) {
            vals = new Map();
            this.map.set(key1, vals);
        }

        let vals2 = vals.get(t.index);
        if (vals2 === undefined) {
            vals2 = [];
            vals.set(t.index, vals2);
        }
        vals2.push(model);
    }
    get(t: Key): Array<T> | undefined {
        return this.map.get(txid_buf_to_string(t.hash))?.get(t.index);
    }

    get_txid_s(t: string, i: number): Array<T> | undefined {
        return this.map.get(t)?.get(i);
    }
}

export function pretty_amount(amount: number) {
    if (amount > 1000) {
        return amount / 100_000_000 + ' BTC';
    } else {
        return amount + ' Sats';
    }
}

// identifier which is stable with different witnesses
export function get_wtxid_backwards(tx: Transaction) {
    return tx.getHash(true).toString('hex');
}

export type TXID = string;
export interface HasKeys {
    get_txid: () => TXID;
}
// Maps an TXID to a Transaction,
export class TXIDAndWTXIDMap<K extends HasKeys> {
    map: Map<TXID, K>;
    constructor() {
        this.map = new Map();
    }
    add(t: K): void {
        this.map.set(t.get_txid(), t);
    }
    get_by_txid(t: K): K | undefined {
        return this.map.get(t.get_txid());
    }
    get_by_txid_s(t: TXID): K | undefined {
        return this.map.get(t);
    }
    delete_by_txid(t: K) {
        this.map.delete(t.get_txid());
    }
    has_by_txid(t: TXID): boolean {
        return this.map.has(t);
    }
}
