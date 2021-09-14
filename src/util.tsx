import { Transaction } from 'bitcoinjs-lib';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { Outpoint } from './UX/Entity/EntitySlice';
// must manually copy from preload
type Callback =
    | 'simulate'
    | 'load_hex'
    | 'save_hex'
    | 'create_contracts'
    | 'load_contract'
    | 'bitcoin-node-bar'
    | 'create_contract_from_cache';
declare global {
    interface Window {
        electron: {
            bitcoin_command: (
                command: {
                    method: string;
                    parameters: any[];
                }[]
            ) => Promise<any>;
            register: (
                msg: Callback,
                action: (args: any) => void
            ) => () => void;
            create_contract: (which: string, args: string) => Promise<any>;
            get_preferences_sync: () => any;
            preferences_listener: (
                listener: (e: any, preferences: any) => void
            ) => void;
            save_psbt: (psbt: string) => Promise<null>;
            save_contract: (contract: string) => Promise<null>;
            fetch_psbt: () => Promise<string>;
        };
    }
}

/// txid_buf_to_string converts a buffer into a reverse encoded hex format.
export function txid_buf_to_string(txid: Buffer): TXID {
    let copy = Buffer.alloc(txid.length);
    txid.forEach((v, i) => {
        copy[txid.length - 1 - i] = v;
    });
    return copy.toString('hex');
}

// hash_to_hex converts a buffer into a reverse encoded hex format
// TODO: is this the same as txid_buf_to_string?
export function hash_to_hex(h: Buffer): string {
    const b = Buffer.alloc(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
}

export interface OutpointInterface {
    index: number;
    hash: Buffer;
}
type OpaqueKey = string;
// Maps an Input (TXID) to all Spenders
export type InputMapT<T> = Record<OpaqueKey, Record<number, Array<T>>>;
export const InputMap = {
    new<T>(): InputMapT<T> {
        return {};
    },
    add<T>(that: InputMapT<T>, t: OutpointInterface, model: T) {
        const key1 = txid_buf_to_string(t.hash);
        let vals = that[key1];
        if (vals === undefined) {
            vals = {};
            that[key1] = vals;
        }

        let vals2 = vals[t.index];
        if (vals2 === undefined) {
            vals2 = [];
            vals[t.index] = vals2;
        }
        vals2.push(model);
    },
    get_txid_s_group<T>(
        that: InputMapT<T>,
        t: string
    ): Record<number, Array<T>> | null {
        return that[t] ?? null;
    },
    get<T>(that: InputMapT<T>, t: OutpointInterface): Array<T> | null {
        return that[txid_buf_to_string(t.hash)]?.[t.index] ?? null;
    },

    get_txid_s<T>(that: InputMapT<T>, t: string, i: number): Array<T> | null {
        return that[t]?.[i] ?? null;
    },
};

export const DEFAULT_MAX_SATS_DISPLAY: number = 9999999;
let INTERNAL_MAX_SATS_DISPLAY: number = DEFAULT_MAX_SATS_DISPLAY;

(() => {
    const preferences = window.electron.get_preferences_sync();
    INTERNAL_MAX_SATS_DISPLAY =
        preferences.display['sats-bound'] ?? DEFAULT_MAX_SATS_DISPLAY;
    window.electron.preferences_listener((_: any, p: any) => {
        INTERNAL_MAX_SATS_DISPLAY =
            p.display['sats-bound'] ?? DEFAULT_MAX_SATS_DISPLAY;
    });
})();

export function PrettyAmount(amount: number) {
    if (amount > INTERNAL_MAX_SATS_DISPLAY) {
        amount /= 100_000_000;
        return (
            <span title={amount.toString() + ' bitcoin'}>
                {amount}
                <span style={{ fontSize: 'larger', color: '#f2a900' }}>₿</span>
            </span>
        );
    } else {
        return (
            <span title={amount.toString() + ' satoshis'}>
                {amount}
                <span style={{ fontSize: 'larger', color: '#f2a900' }}>§</span>
            </span>
        );
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
export type TXIDAndWTXIDMapT<K extends HasKeys> = Record<TXID, K>;
export const TXIDAndWTXIDMap = {
    new() {
        return {};
    },
    add<K extends HasKeys>(that: TXIDAndWTXIDMapT<K>, t: K): void {
        that[t.get_txid()] = t;
    },
    get_by_txid<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: K
    ): K | undefined {
        return that[t.get_txid()];
    },
    get_by_txid_s<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: TXID
    ): K | undefined {
        return that[t];
    },
    delete_by_txid<K extends HasKeys>(that: TXIDAndWTXIDMapT<K>, t: K) {
        delete that[t.get_txid()];
    },
    has_by_txid<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: TXID
    ): boolean {
        return that.hasOwnProperty(t);
    },
};

export function sequence_convert(
    sequence: number
): { relative_time: number; relative_height: number } {
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

// convert a time to a pretty string like
// 6 Hours, 10 Days, 5 Weeks, 3.3 Months
export function time_to_pretty_string(time: number): string {
    time *= 512;
    time /= 6;
    let suffix;
    if (time < 24 && time !== 0) {
        suffix = ' Hours';
    } else {
        time /= 24;
        if (time < 14) {
            suffix = ' Days';
        } else {
            time /= 7;
            if (time < 10) {
                suffix = ' Weeks';
            } else {
                time /= 30;
                suffix = ' Months';
            }
        }
    }
    return (Math.trunc(time * 10) / 10).toString() + suffix;
}

// is_mock_outpoint detects if the Outpoint's hash is sha256('mock:'+index)
// it is useful for external services to tag outputs that are unbound.
export function is_mock_outpoint(args: Outpoint): boolean {
    const hash = Bitcoin.crypto.sha256(Buffer.from('mock:' + args.nIn));
    return txid_buf_to_string(hash) === args.hash;
}
