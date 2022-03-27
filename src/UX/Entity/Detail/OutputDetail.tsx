import { IconButton, Tooltip } from '@mui/material';
import { green } from '@mui/material/colors';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { useDispatch } from 'react-redux';
import { UTXOModel } from '../../../Data/UTXO';
import { PrettyAmountField } from '../../../util';
import { select_utxo } from '../EntitySlice';
import Hex from './Hex';
import './OutputDetail.css';

interface OutputDetailProps {
    txoutput: UTXOModel;
}
export function OutputDetail(props: OutputDetailProps) {
    const dispatch = useDispatch();
    const opts = props.txoutput.getOptions();
    const decomp =
        Bitcoin.script.decompile(opts.utxo.script) ?? Buffer.from('');
    const script = Bitcoin.script.toASM(decomp);

    return (
        <div className="OutputDetail">
            <PrettyAmountField amount={opts.utxo.amount} />
            <Hex className="txhex" value={script} label="Script" />
            <Tooltip title="Go To the Transaction that created this.">
                <IconButton
                    aria-label="goto-creating-txn"
                    onClick={() =>
                        dispatch(
                            select_utxo({
                                hash: opts.txn.get_txid(),
                                nIn: opts.utxo.index,
                            })
                        )
                    }
                >
                    <DoubleArrowIcon style={{ color: green[500] }} />
                </IconButton>
            </Tooltip>
        </div>
    );
}
