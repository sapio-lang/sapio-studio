import { MenuItem, Select, InputLabel } from '@material-ui/core';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import {
    hash_to_hex,
    sequence_convert,
    time_to_pretty_string,
} from '../../../util';
import Hex, { ReadOnly } from './Hex';
import './InputDetail.css';
import { OutpointDetail } from './OutpointDetail';
interface IProps {
    txinput: Bitcoin.TxInput;
    witnesses: Buffer[][];
    psbts: Bitcoin.Psbt[];
    goto: () => void;
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
class PSBTHandler {
    show_flash: (
        msg: string | JSX.Element,
        color: string,
        onclick?: () => void
    ) => void;
    constructor(
        show_flash: (
            msg: string | JSX.Element,
            color: string,
            onclick?: () => void
        ) => void
    ) {
        this.show_flash = show_flash;
    }
    async combine_psbt(psbt: Bitcoin.Psbt) {
        let psbt_in = Bitcoin.Psbt.fromBase64(
            await window.electron.fetch_psbt()
        );
        try {
            psbt.combine(psbt_in);
            this.show_flash('PSBT Combined', 'green');
        } catch (e: any) {
            this.show_flash(
                <div>
                    PSBT Error{' '}
                    <span className="glyphicon glyphicon-question-sign"></span>
                </div>,
                'red',
                () => alert(e.toString())
            );
        }
    }
    async sign_psbt(psbt: string) {
        const command = [{ method: 'walletprocesspsbt', parameters: [psbt] }];
        const signed = (await window.electron.bitcoin_command(command))[0];
        const as_psbt = Bitcoin.Psbt.fromBase64(signed.psbt);
        if (signed.complete) {
            this.show_flash('Fully Signed', 'green');
        } else {
            this.show_flash('Partial Signed', 'red');
        }
        return as_psbt;
    }
    async finalize_psbt(psbt: string) {
        const command = [{ method: 'finalizepsbt', parameters: [psbt] }];
        const result = (await window.electron.bitcoin_command(command))[0];
        if (!result.complete || !result.hex) {
            this.show_flash('PSBT Not Complete', 'red');
            return;
        }
        try {
            const hex_tx = Bitcoin.Transaction.fromHex(result.hex);
            const send = [
                { method: 'sendrawtransaction', parameters: [result.hex] },
            ];

            const sent = (await window.electron.bitcoin_command(send))[0];
            if (sent !== hex_tx.getId()) {
                this.show_flash(
                    <div>
                        Relay Error{' '}
                        <span className="glyphicon glyphicon-question-sign"></span>
                    </div>,
                    'red',
                    () => alert(sent.message.toString())
                );
            } else {
                this.show_flash('Transaction Relayed!', 'green');
            }
        } catch (e: any) {
            this.show_flash(
                <div>
                    PSBT Error{' '}
                    <span className="glyphicon glyphicon-question-sign"></span>
                </div>,
                'red',
                () => alert(e.toString())
            );
        }
    }

    async save_psbt(psbt: string) {
        // no await
        window.electron.save_psbt(psbt);
    }
}
export function InputDetail(props: IProps) {
    const witness_selection_form = React.useRef<HTMLSelectElement>(null);
    const [witness_selection, setWitness] = React.useState(0);
    const [psbt, setPSBT] = React.useState<Bitcoin.Psbt>(props.psbts[0]!);
    const [flash, setFlash] = React.useState<JSX.Element | null>(null);
    if (props.psbts.length === 0) return null;
    if (props.psbts.length !== props.witnesses.length) return null;
    function show_flash(
        msg: string | JSX.Element,
        color: string,
        onclick?: () => void
    ) {
        const click = onclick ?? (() => null);
        const elt = (
            <h3 style={{ color: color }} onClick={click}>
                {msg}
            </h3>
        );
        setFlash(elt);
        setTimeout(() => setFlash(<div></div>), 2000);
    }
    const psbt_handler = new PSBTHandler(show_flash);
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
            <OutpointDetail
                txid={hash_to_hex(props.txinput.hash)}
                n={props.txinput.index}
                onClick={() => props.goto()}
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
                        if (idx < props.psbts.length && idx >= 0) {
                            setPSBT(props.psbts[idx]!);
                            setWitness(idx);
                        }
                    }}
                >
                    {witness_options}
                </Select>
            </form>
            <div>{witness_display}</div>
            {flash}
            <div className="InputDetailPSBT">
                <Hex
                    className="txhex"
                    value={psbt.toBase64()}
                    label="PSBT"
                ></Hex>
                <div className="PSBTActions">
                    <div title="Save PSBT to Disk">
                        <i
                            className="glyphicon glyphicon-floppy-save SavePSBT"
                            onClick={() =>
                                psbt_handler.save_psbt(psbt.toBase64())
                            }
                        ></i>
                    </div>
                    <div title="Sign PSBT Using Node Wallet">
                        <i
                            className="glyphicon glyphicon-pencil SignPSBT"
                            onClick={async () => {
                                const new_psbt = await psbt_handler.sign_psbt(
                                    psbt.toBase64()
                                );
                                // TODO: Confirm this saves to model?
                                psbt.combine(new_psbt);
                                setPSBT(psbt);
                            }}
                        ></i>
                    </div>
                    <div title="Combine PSBT from File">
                        <i
                            className="glyphicon glyphicon-compressed CombinePSBT"
                            onClick={async () => {
                                // TODO: Confirm this saves to model?
                                await psbt_handler.combine_psbt(psbt);
                                setPSBT(psbt);
                            }}
                        ></i>
                    </div>
                    <div title="Attempt Finalizing and Broadcast">
                        <i
                            className="glyphicon glyphicon-send BroadcastPSBT"
                            onClick={async () => {
                                await psbt_handler.finalize_psbt(
                                    psbt.toBase64()
                                );
                                setPSBT(psbt);
                            }}
                        ></i>
                    </div>
                    <div></div>
                </div>
            </div>
        </div>
    );
}
