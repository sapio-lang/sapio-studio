import { Transaction } from 'bitcoinjs-lib';
import React, { ChangeEvent } from 'react';
import * as Bitcoin from 'bitcoinjs-lib';
import { TransactionModel } from '../../../Data/Transaction';
import { UTXOModel } from '../../../Data/UTXO';
import Hex from './Hex';
import { InputDetail } from './InputDetail';
import { TXIDDetail } from './OutpointDetail';
import { OutputDetail } from './OutputDetail';
import _ from 'lodash';
import './TransactionDetail.css';
import {
    sequence_convert,
    time_to_pretty_string,
    txid_buf_to_string,
} from '../../../util';
import Color from 'color';
import { select_utxo } from '../EntitySlice';
import { useDispatch } from 'react-redux';
import { Divider, TextField } from '@material-ui/core';
interface TransactionDetailProps {
    entity: TransactionModel;
    find_tx_model: (a: Buffer, b: number) => UTXOModel | null;
}
interface IState {
    broadcastable: boolean;
    color: Color;
}
export function TransactionDetail(props: TransactionDetailProps) {
    const [broadcastable, setBroadcastable] = React.useState(
        props.entity.is_broadcastable()
    );
    const [color, setColor] = React.useState(
        Color(props.entity.getOptions().color)
    );
    React.useEffect(() => {
        props.entity.set_broadcastable_hook((b) => setBroadcastable(b));

        return () => props.entity.setSelected(false);
    });

    const onchange_color = (e: ChangeEvent<HTMLInputElement>) => {
        let color = new Color(e.target.value);
        props.entity.setColor(color.hex());
        setColor(color);
    };
    const onchange_purpose = (e: ChangeEvent<HTMLInputElement>) => {
        props.entity.setPurpose(e.target.value);
    };
    const dispatch = useDispatch();
    const outs = props.entity.utxo_models.map((o, i) => (
        <OutputDetail
            txoutput={o}
            goto={() =>
                dispatch(
                    select_utxo({
                        hash: o.txn.get_txid(),
                        nIn: o.utxo.index,
                    })
                )
            }
        />
    ));
    const ins = props.entity.tx.ins.map((inp, i) => {
        const witnesses: Buffer[][] = props.entity.witness_set.witnesses.flatMap(
            (w) => {
                let b: Buffer[] | undefined = w[i];
                return b ? [b] : [];
            }
        );
        const psbts: Bitcoin.Psbt[] = props.entity.witness_set.psbts;
        return (
            <InputDetail
                txinput={inp}
                goto={() =>
                    dispatch(
                        select_utxo({
                            hash: txid_buf_to_string(inp.hash),
                            nIn: inp.index,
                        })
                    )
                }
                witnesses={witnesses}
                psbts={psbts}
            />
        );
    });

    const {
        greatest_relative_height,
        greatest_relative_time,
        locktime_enable,
        relative_time_jsx,
        relative_height_jsx,
    } = compute_relative_timelocks(props.entity.tx);

    const locktime = props.entity.tx.locktime;
    const as_date = new Date(1970, 0, 1);
    as_date.setSeconds(locktime);
    const lt =
        !locktime_enable || locktime === 0
            ? 'None'
            : locktime < 500_000_000
            ? 'Block #' + locktime.toString()
            : as_date.toUTCString() + ' MTP';
    // note missing horizontal
    const inner_debounce_color = _.debounce(onchange_color, 30);
    const debounce_color = (e: ChangeEvent<HTMLInputElement>) => {
        e.persist();
        inner_debounce_color(e);
    };
    const inner_debounce_purpose = _.debounce(onchange_purpose, 30);
    const debounce_purpose = (e: ChangeEvent<HTMLInputElement>) => {
        e.persist();
        inner_debounce_purpose(e);
    };
    const absolute_lock_jsx =
        !locktime_enable || locktime === 0 ? null : (
            <>
                <span>Absolute Lock Time:</span>
                <span> {lt} </span>
            </>
        );
    return (
        <div className="TransactionDetail">
            <TXIDDetail txid={props.entity.get_txid()} />
            <Hex
                value={props.entity.tx.toHex()}
                className="txhex"
                label="Tx Hex"
            />
            <TextField
                label="Purpose"
                defaultValue={props.entity.getOptions().purpose}
                onChange={debounce_purpose}
            />
            <div>
                <TextField
                    label={'Color ' + color.hex()}
                    defaultValue={color.hex()}
                    fullWidth
                    type="color"
                    onChange={debounce_color}
                />
            </div>
            <div className="properties">
                {absolute_lock_jsx}
                {relative_height_jsx}
                {relative_time_jsx}
            </div>
            <Divider />
            <h4> Inputs</h4>
            <div className="inputs">{ins}</div>
            <Divider />
            <h4>Outputs</h4>
            <div className="outputs">{outs}</div>
        </div>
    );
}

// TODO: Make this check the input's context
function compute_relative_timelocks(tx: Transaction) {
    const sequences = tx.ins.map((inp) => inp.sequence);
    let greatest_relative_time = 0;
    let greatest_relative_height = 0;
    let locktime_enable = false;
    for (const sequence of sequences) {
        if (sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE) continue;
        locktime_enable = true;
        let { relative_time, relative_height } = sequence_convert(sequence);
        greatest_relative_time = Math.max(
            relative_time,
            greatest_relative_time
        );
        greatest_relative_height = Math.max(
            relative_height,
            greatest_relative_height
        );
    }
    const relative_time_string = time_to_pretty_string(greatest_relative_time);
    const relative_time_jsx =
        greatest_relative_time === 0 ? null : (
            <>
                <span>Relative Lock Time: </span>
                <span>{relative_time_string} </span>
            </>
        );
    const relative_height_jsx =
        greatest_relative_height === 0 ? null : (
            <>
                <span>Relative Height: </span>
                <span>{greatest_relative_height} Blocks</span>
            </>
        );
    return {
        greatest_relative_height,
        greatest_relative_time,
        locktime_enable,
        relative_time_jsx,
        relative_height_jsx,
    };
}
