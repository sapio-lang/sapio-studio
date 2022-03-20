import {
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Tooltip,
} from '@mui/material';
import { orange, purple, red, yellow } from '@mui/material/colors';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Hex from './Hex';
import './PSBTDetail.css';
import { Result } from '../../../util';
interface IProps {
    psbts: Bitcoin.Psbt[];
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
        const psbt_in = Bitcoin.Psbt.fromBase64(
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
        let hex: string;
        const command = [{ method: 'finalizepsbt', parameters: [psbt] }];
        const result = (await window.electron.bitcoin_command(command))[0];
        if (
            (!result.hex && result.complete) ||
            (result.hex && !result.complete)
        ) {
            this.show_flash('PSBT Signing Error :(', 'red');
            return;
        }
        if (result.complete) {
            hex = result.hex;
        } else {
            const new_psbt = result.psbt ?? psbt;
            const sapio_finalized = await window.electron.sapio.psbt.finalize(
                new_psbt
            );
            if ('err' in sapio_finalized) {
                this.show_flash('PSBT Signing Error :(', 'red');
                return;
            }
            const sapio_result:
                | { completed: true; hex: string }
                | {
                      completed: false;
                      psbt: string;
                      error: string;
                      errors: string[];
                  } = JSON.parse(sapio_finalized.ok);
            if (sapio_result.completed) {
                hex = sapio_result.hex;
            } else {
                this.show_flash('PSBT Not Complete', 'red');
                return;
            }
        }
        try {
            const hex_tx = Bitcoin.Transaction.fromHex(hex);
            const send = [{ method: 'sendrawtransaction', parameters: [hex] }];

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
export function PSBTDetail(props: IProps) {
    const psbt_selection_form = React.useRef<HTMLSelectElement>(null);
    const [psbt, setPSBT] = React.useState<Bitcoin.Psbt>(props.psbts[0]!);
    const [flash, setFlash] = React.useState<JSX.Element | null>(null);
    if (props.psbts.length === 0) return null;
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

    const selectable_psbts = props.psbts.map((w, i) => (
        <MenuItem key={i} value={i}>
            {i} -- {w.toBase64().substr(0, 16)}...
        </MenuItem>
    ));
    // missing horizontal
    return (
        <div className="PSBTDetail">
            <InputLabel id="label-select-psbt">PSBT Selection</InputLabel>
            <Select
                labelId="label-select-psbt"
                label="PSBT Selection"
                variant="outlined"
                ref={psbt_selection_form}
                onChange={() => {
                    const idx: number =
                        parseInt(psbt_selection_form.current?.value ?? '0') ??
                        0;
                    if (idx < props.psbts.length && idx >= 0) {
                        setPSBT(props.psbts[idx]!);
                    }
                }}
            >
                {selectable_psbts}
            </Select>
            {flash}
            <Hex
                className="txhex"
                value={psbt.toBase64()}
                label="Selected PSBT"
            ></Hex>
            <div className="PSBTActions">
                <Tooltip title="Save PSBT to Disk">
                    <IconButton
                        aria-label="save-psbt-disk"
                        onClick={() => psbt_handler.save_psbt(psbt.toBase64())}
                    >
                        <SaveIcon style={{ color: red[500] }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Sign PSBT using Node">
                    <IconButton
                        aria-label="sign-psbt-node"
                        onClick={async () => {
                            const new_psbt = await psbt_handler.sign_psbt(
                                psbt.toBase64()
                            );
                            // TODO: Confirm this saves to model?
                            psbt.combine(new_psbt);
                            setPSBT(psbt);
                        }}
                    >
                        <VpnKeyIcon style={{ color: yellow[500] }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Combine PSBT from File">
                    <IconButton
                        aria-label="combine-psbt-file"
                        onClick={async () => {
                            // TODO: Confirm this saves to model?
                            await psbt_handler.combine_psbt(psbt);
                            setPSBT(psbt);
                        }}
                    >
                        <MergeTypeIcon style={{ color: purple[500] }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Finalize and Broadcast PSBT with Node">
                    <IconButton
                        aria-label="combine-psbt-file"
                        onClick={async () => {
                            await psbt_handler.finalize_psbt(psbt.toBase64());
                            setPSBT(psbt);
                        }}
                    >
                        <SendIcon style={{ color: orange[500] }} />
                    </IconButton>
                </Tooltip>
                <div></div>
            </div>
        </div>
    );
}
