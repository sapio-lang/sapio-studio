import { Transaction } from 'bitcoinjs-lib';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { useSelector } from 'react-redux';
import { selectMaxSats } from './Settings/SettingsSlice';
import { APIs } from './UX/ContractCreator/ContractCreatorSlice';
import { schemas } from './UX/Settings/Schemas';
import { CreatedContract } from './AppSlice';
// must manually copy from preload
type Callback =
    | 'simulate'
    | 'load_hex'
    | 'save_hex'
    | 'create_contracts'
    | 'load_contract'
    | 'bitcoin-node-bar';
export type Result<T, E = string> = { ok: T } | { err: E };
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
            save_psbt: (psbt: string) => Promise<null>;
            save_contract: (contract: string) => Promise<null>;
            fetch_psbt: () => Promise<string>;
            write_clipboard: (s: string) => void;
            save_settings: (
                which: keyof typeof schemas,
                data: string
            ) => Promise<boolean>;
            load_settings_sync: (which: keyof typeof schemas) => Promise<any>;
            select_filename: () => Promise<string | null>;
            sapio: {
                show_config: () => Promise<Result<string>>;
                load_wasm_plugin: () => Promise<Result<null>>;
                open_contract_from_file: () => Promise<Result<string>>;
                load_contract_list: () => Promise<Result<APIs>>;
                create_contract: (
                    which: string,
                    args: string
                ) => Promise<Result<string | null>>;
                compiled_contracts: {
                    list: () => Promise<string[]>;
                    trash: (file_name: string) => Promise<void>;
                    open: (
                        file_name: string
                    ) => Promise<Result<CreatedContract>>;
                };
                psbt: {
                    finalize: (psbt: string) => Promise<Result<string>>;
                };
            };
            emulator: {
                kill: () => Promise<void>;
                start: () => Promise<void>;
                read_log: () => Promise<string>;
            };
        };
    }
}

/// txid_buf_to_string converts a buffer into a reverse encoded hex format.
export function txid_buf_to_string(txid: Buffer): TXID {
    const copy = Buffer.alloc(txid.length);
    txid.forEach((v, i) => {
        copy[txid.length - 1 - i] = v;
    });
    return copy.toString('hex');
}

// hash_to_hex converts a buffer into a reverse encoded hex format
// TODO: is this the same as txid_buf_to_string?
export function hash_to_hex(h: Buffer): string {
    return txid_buf_to_string(h);
}

export interface OutpointInterface {
    index: number;
    hash: Buffer;
}
type OpaqueKey = string;
// Maps an Input (TXID) to all Spenders
const input_map_s = Symbol('InputMapT');
export type InputMapT<T> = {
    [input_map_s]: Record<OpaqueKey, Record<number, Array<T>>>;
};
export const InputMap = {
    new<T>(): InputMapT<T> {
        return { [input_map_s]: {} };
    },
    add<T>(that: InputMapT<T>, t: OutpointInterface, model: T) {
        const key1 = txid_buf_to_string(t.hash);
        let vals = that[input_map_s][key1];
        if (vals === undefined) {
            vals = {};
            that[input_map_s][key1] = vals;
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
        return that[input_map_s][t] ?? null;
    },
    get<T>(that: InputMapT<T>, t: OutpointInterface): Array<T> | null {
        return that[input_map_s][txid_buf_to_string(t.hash)]?.[t.index] ?? null;
    },

    get_txid_s<T>(that: InputMapT<T>, t: string, i: number): Array<T> | null {
        return that[input_map_s][t]?.[i] ?? null;
    },
};

export function PrettyAmount(amount: number) {
    const max_sats = useSelector(selectMaxSats);
    if (amount > max_sats) {
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

export function PrettyAmountField(props: { amount: number }) {
    let amount = props.amount;
    const max_sats = useSelector(selectMaxSats);
    if (amount > max_sats) {
        amount /= 100_000_000;
        return (
            <TextField
                label="Amount (btc)"
                type="text"
                value={amount}
                variant="outlined"
                InputProps={{
                    readOnly: true,
                    endAdornment: (
                        <InputAdornment position="end">
                            <span
                                style={{ fontSize: 'larger', color: '#f2a900' }}
                            >
                                ₿
                            </span>
                        </InputAdornment>
                    ),
                }}
            />
        );
    } else {
        return (
            <TextField
                label="Amount (sats)"
                type="text"
                value={amount}
                variant="outlined"
                InputProps={{
                    readOnly: true,
                    endAdornment: (
                        <InputAdornment position="end">
                            <span
                                style={{ fontSize: 'larger', color: '#f2a900' }}
                            >
                                §
                            </span>
                        </InputAdornment>
                    ),
                }}
            />
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
const txid_map_s = Symbol('TXIDAndWTXIDMapT');
export type TXIDAndWTXIDMapT<K extends HasKeys> = {
    [txid_map_s]: Record<TXID, K>;
};
export const TXIDAndWTXIDMap = {
    new() {
        return { [txid_map_s]: {} };
    },
    add<K extends HasKeys>(that: TXIDAndWTXIDMapT<K>, t: K): void {
        that[txid_map_s][t.get_txid()] = t;
    },
    get_by_txid<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: K
    ): K | undefined {
        return that[txid_map_s][t.get_txid()];
    },
    get_by_txid_s<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: TXID
    ): K | undefined {
        return that[txid_map_s][t];
    },
    delete_by_txid<K extends HasKeys>(that: TXIDAndWTXIDMapT<K>, t: K) {
        delete that[txid_map_s][t.get_txid()];
    },
    has_by_txid<K extends HasKeys>(
        that: TXIDAndWTXIDMapT<K>,
        t: TXID
    ): boolean {
        return that[txid_map_s].hasOwnProperty(t);
    },
};

export function sequence_convert(sequence: number): {
    relative_time: number;
    relative_height: number;
} {
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

export type Outpoint = { hash: string; nIn: number };
type OutpointStringDifferentiator = string;
export type OutpointString = OutpointStringDifferentiator & string;

export const ValidateOutpointString = (out: string): out is OutpointString => {
    return out.match(/^[A-Fa-f0-9]{64}:[0-9]+$/) !== null;
};

export function outpoint_to_id(args: Outpoint): OutpointString {
    const s = args.hash + ':' + args.nIn.toString();
    if (ValidateOutpointString(s)) return s;
    throw 'ERR: ID not valid';
}
