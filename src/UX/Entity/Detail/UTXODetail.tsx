import * as Bitcoin from 'bitcoinjs-lib';
import Hex, { ASM } from './Hex';
import {
    get_wtxid_backwards,
    is_mock_outpoint,
    PrettyAmount,
    txid_buf_to_string,
} from '../../../util';
import { UTXOModel } from '../../../Data/UTXO';
import './UTXODetail.css';
import { OutpointDetail } from './OutpointDetail';
import {
    PhantomTransactionModel,
    TransactionModel,
} from '../../../Data/Transaction';
import { ContractModel } from '../../../Data/ContractManager';
import Button from 'react-bootstrap/esm/Button';
import { useDispatch, useSelector } from 'react-redux';
import {
    create,
    fetch_utxo,
    selectUTXOFlash,
    selectUTXO,
    select_txn,
} from '../EntitySlice';
import React from 'react';

interface UTXODetailProps {
    entity: UTXOModel;
    contract: ContractModel;
}

export function UTXODetail(props: UTXODetailProps) {
    const dispatch = useDispatch();
    React.useEffect(() => {
        return () => {};
    });
    const txid = props.entity.txn.get_txid();
    const idx = props.entity.utxo.index;
    const outpoint = { hash: txid, nIn: idx };

    const external_utxo = useSelector(selectUTXO)(outpoint);
    const flash = useSelector(selectUTXOFlash);
    const this_is_mock = is_mock_outpoint(outpoint);
    const is_confirmed = external_utxo && external_utxo.confirmations > 0;
    const decomp =
        external_utxo?.scriptPubKey.address ??
        Bitcoin.script.toASM(
            Bitcoin.script.decompile(props.entity.utxo.script) ??
                Buffer.from('')
        );
    // first attempt to get the address from the extenral utxo if it's present,
    // otherwise attempt to read if from the utxo model
    let address = external_utxo?.scriptPubKey.address;
    if (!address) {
        address = 'UNKNOWN';
        try {
            address = Bitcoin.address.fromOutputScript(
                props.entity.utxo.script,
                /// TODO: Read from preferences?
                Bitcoin.networks.regtest
            );
        } catch {}
    }
    const spends = props.entity.utxo.spends.map((elt, i) => (
        <div key={get_wtxid_backwards(elt.tx)} className="Spend">
            <Hex value={elt.get_txid()} />
            <Button
                variant="link"
                onClick={() => dispatch(select_txn(elt.get_txid()))}
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
            : PrettyAmount(props.entity.utxo.amount);

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
                onClick={() => dispatch(select_txn(txid))}
            />
            <div>
                Address: <ASM className="txhex" readOnly value={address} />
            </div>
            <div>Spent By: {spends}</div>
        </div>
    );
}
