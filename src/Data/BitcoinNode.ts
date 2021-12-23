import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractBase, ContractModel } from './ContractManager';
import { Input } from 'bitcoinjs-lib/types/transaction';
import { hash_to_hex, TXIDAndWTXIDMap } from '../util';
import * as Bitcoin from 'bitcoinjs-lib';
import { clamp } from 'lodash';
import { DiagramModel } from '@projectstorm/react-diagrams-core';
import { selectNodePollFreq } from '../Settings/SettingsSlice';
import { store } from '../Store/store';

type TXID = string;

export function call(method: string, args: any) {
    return fetch(method, {
        method: 'post',
        body: JSON.stringify(args),
        headers: {
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
        },
    }).then((res) => res.json());
}
interface IProps {
    model: DiagramModel;
    current_contract: ContractModel;
}
export function update_broadcastable(
    current_contract: ContractModel,
    confirmed_txs: Set<TXID>
) {
    current_contract.txn_models.forEach((tm) => {
        const already_confirmed = confirmed_txs.has(tm.get_txid());
        const inputs_not_locals = tm.tx.ins.every(
            (inp: Input) =>
                !TXIDAndWTXIDMap.has_by_txid(
                    current_contract.txid_map,
                    hash_to_hex(inp.hash)
                )
        );
        const all_inputs_confirmed = tm.tx.ins.every((inp: Input) =>
            confirmed_txs.has(hash_to_hex(inp.hash))
        );
        if (already_confirmed) {
            tm.set_broadcastable(false);
        } else if (inputs_not_locals) {
            tm.set_broadcastable(true);
        } else if (all_inputs_confirmed) {
            tm.set_broadcastable(true);
        } else {
            tm.set_broadcastable(false);
        }
    });
}

/*
Currently non-functional, needs a server to be running somewhere.

Should be upgraded to a socket managed driver that does not use polling.
*/
export class BitcoinNodeManager {
    props: IProps;
    mounted: boolean;
    next_periodic_check: NodeJS.Timeout;
    constructor(props: IProps) {
        this.props = props;
        this.mounted = true;
        this.next_periodic_check = setTimeout(
            this.periodic_check.bind(this),
            1000
        );
    }
    destroy() {
        this.mounted = false;
        if (this.next_periodic_check != null)
            clearTimeout(this.next_periodic_check);
    }
    async periodic_check() {
        const contract = this.props.current_contract;
        console.info('PERIODIC CONTRACT CHECK');
        if (!contract.should_update()) {
            // poll here faster
            this.next_periodic_check = setTimeout(
                this.periodic_check.bind(this),
                1000
            );
            return;
        }
        const is_tx_confirmed = await this.get_confirmed_transactions(contract);
        let confirmed_txs: Set<TXID> = new Set();
        is_tx_confirmed.forEach((txid: TXID) => confirmed_txs.add(txid));
        if (is_tx_confirmed.length > 0) {
            update_broadcastable(contract, confirmed_txs);
            this.props.current_contract.process_finality(
                is_tx_confirmed,
                this.props.model
            );
        }
        if (this.mounted) {
            const freq = selectNodePollFreq(store.getState());
            const period = clamp(freq, 5, 60 * 5);

            console.info('NEXT PERIODIC CONTRACT CHECK ', period, ' SECONDS');
            this.next_periodic_check = setTimeout(
                this.periodic_check.bind(this),
                1000 * period
            );
        }
    }

    static async fund_out(tx: Transaction): Promise<Transaction> {
        const result = await window.electron.bitcoin_command([
            { method: 'fundrawtransaction', parameters: [tx.toHex()] },
        ]);
        if (result[0] && result[0].name === 'RpcError') {
            throw result[0];
        }
        const hex: string = result[0].hex;
        return Transaction.fromHex(hex);
    }

    static async fetch_utxo(t: TXID, n: number): Promise<QueriedUTXO | null> {
        const txout = (
            await window.electron.bitcoin_command([
                { method: 'getrawtransaction', parameters: [t, true] },
            ])
        )[0];
        if (!txout || txout.name === 'RpcError') {
            return null;
        }
        return {
            blockhash: txout.blockhash,
            confirmations: txout.confirmations,
            scriptPubKey: txout.vout[n].scriptPubKey,
            value: txout.vout[n].value,
        };
    }
    async check_balance(): Promise<number> {
        let results = await window.electron.bitcoin_command([
            { method: 'getbalance', parameters: [] },
        ]);
        return results[0];
    }
    async blockchaininfo(): Promise<any> {
        return (
            await window.electron.bitcoin_command([
                { method: 'getblockchaininfo', parameters: [] },
            ])
        )[0];
    }
    async get_new_address(): Promise<string> {
        return (
            await window.electron.bitcoin_command([
                { method: 'getnewaddress', parameters: [] },
            ])
        )[0];
    }

    async send_to_address(amount: number, address: string): Promise<void> {
        return (
            await window.electron.bitcoin_command([
                { method: 'sendtoaddress', parameters: [address, amount] },
            ])
        )[0];
    }

    async list_transactions(count: number): Promise<any> {
        return (
            await window.electron.bitcoin_command([
                { method: 'listtransactions', parameters: ['*', count] },
            ])
        )[0];
    }
    async generate_blocks(n: number): Promise<void> {
        const addr = await this.get_new_address();
        await window.electron.bitcoin_command([
            { method: 'generatetoaddress', parameters: [10, addr] },
        ]);
    }
    // get info about transactions
    async get_confirmed_transactions(
        current_contract: ContractModel
    ): Promise<Array<TXID>> {
        // TODO: SHould query by WTXID
        const txids = current_contract.txn_models
            .filter((tm) => tm.is_broadcastable())
            .map((tm) => {
                return {
                    method: 'getrawtransaction',
                    parameters: [tm.get_txid(), true],
                };
            });
        if (txids.length > 0) {
            let results = await window.electron.bitcoin_command(txids);
            // TODO: Configure Threshold
            results = results
                .filter((txdata: any) => txdata.confirmations ?? 0 > 1)
                .map((txdata: any) => txdata.txid);
            return results;
        }
        return [];
    }

    render() {
        return null;
    }
}

export interface QueriedUTXO {
    blockhash: string;
    confirmations: number;
    scriptPubKey: { asm: string; hex: string; address: string; type: string };
    value: number;
}
