import { InputLabel, MenuItem, Select } from '@material-ui/core';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { useDispatch } from 'react-redux';
import {
    sequence_convert,
    time_to_pretty_string,
    txid_buf_to_string,
} from '../../../util';
import Hex, { ReadOnly } from './Hex';
import './InputDetail.css';
import { RefOutpointDetail } from './OutpointDetail';
interface IProps {
    txinput: Bitcoin.TxInput;
    witnesses: Buffer[][];
}
function maybeDecode(to_asm: boolean, elt: Buffer): string {
    if (to_asm) {
        return Bitcoin.script.toASM(
            Bitcoin.script.decompile(elt) ?? Buffer.from('')
        );
    } else {
        return elt.toString('hex');
    }
}
export function InputDetail(props: IProps) {
    const dispatch = useDispatch();
    const witness_selection_form = React.useRef<HTMLSelectElement>(null);
    const [witness_selection, setWitness] = React.useState(0);
    let witness_display = null;
    if (
        witness_selection !== undefined &&
        props.witnesses.length > witness_selection
    ) {
        const index: number = witness_selection;
        witness_display = props.witnesses[index]!.map((elt, i) => (
            <Hex key={i} className="txhex" value={maybeDecode(true, elt)} />
        ));
    }
    const scriptValue = Bitcoin.script.toASM(
        Bitcoin.script.decompile(props.txinput.script) ??
            Buffer.from('Error Decompiling')
    );
    const seq = props.txinput.sequence;
    const { relative_time, relative_height } = sequence_convert(seq);
    const sequence =
        relative_time === 0 ? (
            relative_height === 0 ? null : (
                <div className="InputDetailSequence">
                    <ReadOnly
                        value={relative_height.toString()}
                        label="Relative Height"
                    ></ReadOnly>
                </div>
            )
        ) : (
            <div className="InputDetailSequence">
                <ReadOnly
                    value={time_to_pretty_string(relative_time)}
                    label="Relative Time"
                ></ReadOnly>
            </div>
        );

    const witness_options = props.witnesses.map((w, i) => (
        <MenuItem key={i} value={i}>
            {i}
        </MenuItem>
    ));
    const scriptSig =
        props.txinput.script.length === 0 ? null : (
            <div className="InputDetailScriptSig">
                <Hex
                    className="txhex"
                    value={scriptValue}
                    label="ScriptSig"
                ></Hex>
            </div>
        );
    // missing horizontal
    return (
        <div className="InputDetail">
            <RefOutpointDetail
                txid={txid_buf_to_string(props.txinput.hash)}
                n={props.txinput.index}
            />
            {sequence}
            {scriptSig}
            <form>
                <InputLabel id="label-select-witness">Witness</InputLabel>
                <Select
                    labelId="label-select-witness"
                    label="Witness"
                    variant="outlined"
                    ref={witness_selection_form}
                    onChange={() => {
                        const idx: number =
                            parseInt(
                                witness_selection_form.current?.value ?? '0'
                            ) ?? 0;
                        if (idx < props.witnesses.length && idx >= 0) {
                            setWitness(idx);
                        }
                    }}
                >
                    {witness_options}
                </Select>
            </form>
            <div>{witness_display}</div>
        </div>
    );
}
