import { Transaction } from "bitcoinjs-lib";

interface Key {
    index: number,
    hash: Buffer
}
export type OpaqueKey = string;
export function keyFn(key: Key): OpaqueKey {
    return key.hash.toString('hex')+','+key.index;
}
export function pretty_amount(amount: number) {
    if (amount > 1000) {
        return (amount/100_000_000) + " BTC";
    } else {
        return (amount) + " Sats";
    }
}

// identifier which is stable with different witnesses
export function get_wtxid_backwards(tx:Transaction) {
    return tx.getHash(true).toString('hex');
}