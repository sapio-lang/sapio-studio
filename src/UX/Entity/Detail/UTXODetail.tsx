import * as Bitcoin from 'bitcoinjs-lib';
import Hex, { ASM } from './Hex';
import {
    get_wtxid_backwards,
    pretty_amount,
    txid_buf_to_string,
} from '../../../util';
import { UTXOModel } from '../../../Data/UTXO';
import './UTXODetail.css';
import { OutpointDetail } from './OutpointDetail';
import { NodeModel } from '@projectstorm/react-diagrams';
import {
    PhantomTransactionModel,
    TransactionModel,
} from '../../../Data/Transaction';
import { Data, ContractModel } from '../../../Data/ContractManager';
import Button from 'react-bootstrap/esm/Button';
import { useDispatch, useSelector } from 'react-redux';
import {
    create,
    fetch_utxo,
    selectUTXOFlash,
    Outpoint,
    selectUTXO,
    select_entity,
    deselect_entity,
} from '../EntitySlice';
import React from 'react';
import { Dispatch } from 'redux';
import { create_contract_of_type } from '../../../AppSlice';

interface UTXODetailProps {
    entity: UTXOModel;
    contract: ContractModel;
}

function is_mock(args: Outpoint): boolean {
    const hash = Bitcoin.crypto.sha256(new Buffer('mock:' + args.nIn));
    return txid_buf_to_string(hash) === args.hash;
}

export function update_utxomodel(utxo_in: UTXOModel) {
    const s: Array<UTXOModel> = [utxo_in];
    for (let count = 0; count < s.length; ++count) {
        const utxo = s[count];
        // Pop a node for processing...
        utxo.utxo.spends.forEach((spend: TransactionModel) => {
            spend.tx.ins
                .filter(
                    (inp) => txid_buf_to_string(inp.hash) === utxo.utxo.txid
                )
                .forEach((inp) => {
                    inp.hash = utxo.txn.tx.getHash();
                });
            spend.tx.ins
                .filter((inp) =>
                    is_mock({
                        hash: txid_buf_to_string(inp.hash),
                        nIn: inp.index,
                    })
                )
                .forEach((inp) => {
                    // TODO: Only modify the mock that was intended
                    inp.hash = utxo.txn.tx.getHash();
                    inp.index = utxo.utxo.index;
                });

            spend.utxo_models.forEach((u: UTXOModel) => s.push(u));
        });
    }
}
export function UTXODetail(props: UTXODetailProps) {
    React.useEffect(() => {
        return () => {
            props.entity.setSelected(false);
        };
    });

    const dispatch = useDispatch();
    const select_utxo = useSelector(selectUTXO);
    const flash = useSelector(selectUTXOFlash);
    const txid = props.entity.txn.get_txid();
    const idx = props.entity.utxo.index;
    const outpoint = { hash: txid, nIn: idx };
    const this_is_mock = is_mock(outpoint);
    const utxo = select_utxo(outpoint);
    const is_confirmed = utxo && utxo.confirmations > 0;
    const decomp =
        utxo?.scriptPubKey.address ??
        Bitcoin.script.toASM(
            Bitcoin.script.decompile(props.entity.utxo.script) ??
                Buffer.from('')
        );
    let address = utxo?.scriptPubKey.address;
    if (!address) {
        address = 'UNKNOWN';
        try {
            address = Bitcoin.address.fromOutputScript(
                props.entity.utxo.script,
                Bitcoin.networks.regtest
            );
        } catch {}
    }
    const spends = props.entity.utxo.spends.map((elt, i) => (
        <div key={get_wtxid_backwards(elt.tx)} className="Spend">
            <Hex value={elt.get_txid()} />
            <Button
                variant="link"
                onClick={() => dispatch(select_entity(elt.get_txid()))}
            >
                <span
                    className="glyphicon glyphicon-chevron-right"
                    style={{ color: 'green' }}
                    title="Go To The Spending Transaction"
                ></span>
            </Button>
        </div>
    ));
    const creator =
        !this_is_mock || is_confirmed ? null : (
            <Button
                variant="link"
                onClick={() =>
                    dispatch(
                        create(
                            props.entity.txn.tx,
                            props.entity,
                            props.contract
                        )
                    )
                }
            >
                <span
                    className="glyphicon glyphicon-cloud-plus"
                    style={{ color: 'green' }}
                    title="Create Output"
                ></span>
            </Button>
        );
    const check_exists =
        this_is_mock || is_confirmed ? null : (
            <Button
                variant="link"
                onClick={() => dispatch(fetch_utxo(outpoint))}
            >
                <span
                    className="glyphicon glyphicon-cloud-download"
                    style={{ color: 'purple' }}
                    title="Query Node for this Output"
                ></span>
            </Button>
        );
    const title =
        props.entity.txn instanceof PhantomTransactionModel
            ? 'External UTXO'
            : pretty_amount(props.entity.utxo.amount);

    return (
        <div className="UTXODetail">
            <div>{flash}</div>
            <div>
                {creator}
                {check_exists}
            </div>
            <p>{title}</p>

            <OutpointDetail
                txid={txid}
                n={idx}
                onClick={() => dispatch(select_entity(txid))}
            />
            <div>
                Address: <ASM className="txhex" readOnly value={address} />
            </div>
            <div>Spent By: {spends}</div>
        </div>
    );
}
