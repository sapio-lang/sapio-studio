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

export type Status = { txid: TXID; confirmations: number; exists: boolean };

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
    limbo_tx: TXID
) {
    const tm = TXIDAndWTXIDMap.get_by_txid_s(
        current_contract.txid_map,
        limbo_tx
    );
    if (!tm) {
        throw new Error(
            `Invariant Error: ${limbo_tx} must exist in contract model`
        );
    }
    const is_broadcastable = tm.tx.ins.every((inp: Input) => {
        const tmi = TXIDAndWTXIDMap.get_by_txid_s(
            current_contract.txid_map,
            hash_to_hex(inp.hash)
        );
        switch (tmi?.confirmation()) {
            // means "external", assumed to be confirmed
            case undefined:
            case 'Confirmed':
            case 'InMempool':
                return true;
            // in these cases, something else must be broadcast first.
            // note: no parent at this phase could go from Unknown -> Confirmed
            // since that was handled earlier.
            case 'Impossible':
            case 'Broadcastable':
            case 'NotBroadcastable':
            case 'Unknown':
                return false;
        }
    });
    if (is_broadcastable) {
        tm.setConfirmed('Broadcastable');
    } else {
        tm.setConfirmed('NotBroadcastable');
    }
}

interface ICommand {
    method: string;
    parameters: any[];
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

    /**
     * Execute a Bitcoin rpc call
     * @param command { method: string, parameters: any[] }
     * @returns result of the command or throws an error
     */
    async execute(command: ICommand) {
        const [result] = await window.electron.bitcoin_command([command]);
        if (result === undefined) {
            throw new Error('Unexpected result returned');
        }
        if (result?.name === 'RpcError') {
            throw result;
        }
        return result;
    }

    /**
     * Execute a batched Bitcoin rpc call
     * @param commands [{ method: string, parameters: any[] },...]
     * @returns returns an array of results, results can include error objects
     */
    async executeBatch(commands: ICommand[]) {
        return window.electron.bitcoin_command(commands);
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
        const is_tx_confirmed = await this.get_transaction_status(contract);
        if (is_tx_confirmed.length > 0) {
            this.props.current_contract.map_contract_model(
                new Set(
                    is_tx_confirmed
                        .filter((t) => t.confirmations === 0)
                        .map((t) => t.txid)
                ),
                this.props.model,
                'InMempool'
            );
            this.props.current_contract.map_contract_model(
                new Set(
                    is_tx_confirmed
                        .filter((t) => t.confirmations > 0)
                        .map((t) => t.txid)
                ),
                this.props.model,
                'Confirmed'
            );
            this.props.current_contract.map_contract_model(
                new Set(
                    is_tx_confirmed
                        .filter((t) => t.confirmations < 0)
                        .map((t) => t.txid)
                ),
                this.props.model,
                'Impossible'
            );
            const limbo_txs: Set<TXID> = new Set(
                is_tx_confirmed.filter((t) => !t.exists).map((t) => t.txid)
            );
            this.props.current_contract.map_contract_model(
                limbo_txs,
                this.props.model,
                'Unknown'
            );
            for (let limbo_tx of limbo_txs) {
                update_broadcastable(contract, limbo_tx);
            }
        }
        if (this.mounted) {
            const freq = selectNodePollFreq(store.getState());
            const period = clamp(freq ?? 0, 5, 60 * 5);

            console.info('NEXT PERIODIC CONTRACT CHECK ', period, ' SECONDS');
            this.next_periodic_check = setTimeout(
                this.periodic_check.bind(this),
                1000 * period
            );
        }
    }

    // TODO: make this not static so we can use `execute` directly instead of `bitcoin_command`
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

    // TODO: make this not static so we can use `execute` directly instead of `bitcoin_command`
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
        return this.execute({ method: 'getbalance', parameters: [] });
    }
    async blockchaininfo(): Promise<any> {
        return this.execute({ method: 'getblockchaininfo', parameters: [] });
    }
    async get_new_address(): Promise<string> {
        return this.execute({ method: 'getnewaddress', parameters: [] });
    }

    async send_to_address(amount: number, address: string): Promise<void> {
        return this.execute({
            method: 'sendtoaddress',
            parameters: [address, amount],
        });
    }

    async list_transactions(count: number): Promise<any> {
        return this.execute({
            method: 'listtransactions',
            parameters: ['*', count],
        });
    }
    async generate_blocks(n: number): Promise<void> {
        const addr = await this.get_new_address();
        return this.execute({
            method: 'generatetoaddress',
            parameters: [n, addr],
        });
    }
    // get info about transactions
    async get_transaction_status(
        current_contract: ContractModel
    ): Promise<Array<Status>> {
        // TODO: SHould query by WTXID
        const txids = current_contract.txn_models
            //            .filter((tm) => tm.is_broadcastable())
            .map((tm) => tm.get_txid());
        const req = txids.map((txid) => {
            return {
                method: 'getrawtransaction',
                parameters: [txid, true],
            };
        });
        if (txids.length > 0) {
            let results: (
                | Status
                | { message: string; code: number; name: string }
            )[] = await this.executeBatch(req);
            console.log(results);
            // TODO: Configure Threshold
            return results.map((txdata, idx: number) => {
                let s: Status;
                if ('code' in txdata) {
                    s = { txid: txids[idx]!, confirmations: -1, exists: false };
                } else {
                    s = {
                        txid: txdata.txid,
                        confirmations: txdata.confirmations,
                        exists: true,
                    };
                }
                return s;
            });
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
