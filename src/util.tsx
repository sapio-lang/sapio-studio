import { Transaction } from 'bitcoinjs-lib';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';

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

export const DEFAULT_MAX_SATS_DISPLAY: number = 9999999;
let INTERNAL_MAX_SATS_DISPLAY: number = DEFAULT_MAX_SATS_DISPLAY;

(() => {
    //const preferences = window.electron.get_preferences_sync();
    //INTERNAL_MAX_SATS_DISPLAY = preferences.value("display.sats-bound") ?? DEFAULT_MAX_SATS_DISPLAY;
    //window.electron.preferences_listener((_: any, p: any) => {
    //    INTERNAL_MAX_SATS_DISPLAY = p.value("display.sats-bound") ?? DEFAULT_MAX_SATS_DISPLAY;
    //});
})();

export function pretty_amount(amount: number) {
    if (amount > INTERNAL_MAX_SATS_DISPLAY) {
        amount /= 100_000_000;
        return (<span title={amount.toString() + " bitcoin"}>{amount}<span style={{ fontSize: "larger", color: "#f2a900" }}>₿</span></span>);
    } else {
        return (<span title={amount.toString() + " satoshis"}>{amount}<span style={{ fontSize: "larger", color: "#f2a900" }}>§</span></span>);
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

export function hash_to_hex(h: Buffer): string {
    const b = new Buffer(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
}

export function sequence_convert(sequence: number): { relative_time: number, relative_height: number } {
    const ret = { relative_time: 0, relative_height: 0 };
    if (sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE) return ret;
    if (sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE - 1) return ret;
    const s_mask = 0xffff & sequence;
    if ((1 << 22) & sequence) {
        ret.relative_time = s_mask;
    } else {
        ret.relative_height = s_mask;
    }
    return ret;
}
export function time_to_pretty_string(time: number): string {
    time *= 512;
    let relative_time_string = 'None';
    time /= 60 * 60;
    let suffix = "?";
    if (time < 24 && time !== 0) {
        suffix = " Hours";
    } else {
        time /= 24;
        if (time < 14) {
            relative_time_string =
                suffix = " Days";
        } else {
            time /= 7;
            if (time < 10) {
                suffix = " Weeks";
            } else {
                time /= 30;
                suffix = " Months";
            }
        }
    }
    return (Math.trunc(time * 10) / 10).toString() + suffix;
}