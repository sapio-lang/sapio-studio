import { JSONSchema7 } from 'json-schema';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import { green, purple } from '@mui/material/colors';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ContractModel } from '../../../Data/ContractManager';
import { PhantomTransactionModel } from '../../../Data/Transaction';
import { UTXOModel } from '../../../Data/UTXO';
import {
    get_wtxid_backwards,
    hasOwn,
    is_mock_outpoint,
    PrettyAmountField,
    TXIDAndWTXIDMap,
} from '../../../util';
import {
    create,
    EntityType,
    fetch_utxo,
    selectEntityToView,
    selectUTXO,
    selectUTXOFlash,
    select_txn,
} from '../EntitySlice';
import Hex, { ASM } from './Hex';
import { OutpointDetail } from './OutpointDetail';
import './UTXODetail.css';
import { selectContinuation } from '../../ContractCreator/ContractCreatorSlice';
import Form, { FormValidation, ISubmitEvent } from '@rjsf/core';
import {
    add_effect_to_contract,
    recreate_contract,
    selectHasEffect,
} from '../../../AppSlice';
import { RootState } from '../../../Store/store';
import {
    Continuation,
    UTXOFormatData,
} from '../../../common/preload_interface';

interface UTXODetailProps {
    entity: UTXOModel;
    contract: ContractModel;
}

const C = React.memo(UTXODetailInner, (prev, next) => {
    const b = prev.entity == next.entity && prev.contract == next.contract;
    console.log('NEWCHECK?', b);
    return b;
});
export function UTXODetail(props: { contract: ContractModel }) {
    const entity_id: EntityType = useSelector(selectEntityToView);
    const entity =
        entity_id[0] === 'UTXO'
            ? TXIDAndWTXIDMap.get_by_txid_s(
                  props.contract.txid_map,
                  entity_id[1].hash
              )?.utxo_models[entity_id[1].nIn] ?? null
            : null;
    return (
        <div hidden={entity === null}>
            {entity && <C contract={props.contract} entity={entity}></C>}
        </div>
    );
}

export function UTXODetailInner(props: UTXODetailProps) {
    const theme = useTheme();
    const dispatch = useDispatch();
    const select_continuations = useSelector(selectContinuation);
    const opts = props.entity.getOptions();
    const txid = opts.txn.get_txid();
    const idx = opts.utxo.index;
    const outpoint = { hash: txid, nIn: idx };

    const external_utxo = useSelector(selectUTXO)(outpoint);
    const flash = useSelector(selectUTXOFlash);
    const this_is_mock = is_mock_outpoint(outpoint);
    const is_confirmed = external_utxo && external_utxo.confirmations > 0;
    const decomp =
        external_utxo?.scriptPubKey.address ??
        Bitcoin.script.toASM(
            Bitcoin.script.decompile(opts.utxo.script) ?? Buffer.from('')
        );
    // first attempt to get the address from the extenral utxo if it's present,
    // otherwise attempt to read if from the utxo model
    let address = external_utxo?.scriptPubKey.address;
    let asm = external_utxo?.scriptPubKey.asm ?? null;
    if (!address) {
        address = 'UNKNOWN';
        try {
            asm = Bitcoin.script.toASM(opts.utxo.script);
            address = Bitcoin.address.fromOutputScript(
                opts.utxo.script,
                /// TODO: Read from preferences?
                Bitcoin.networks.regtest
            );
        } catch {
            // TODO: Recovery?
        }
    }
    const spends = opts.utxo.spends.map((elt, i) => (
        <div key={get_wtxid_backwards(elt.tx)} className="Spend">
            <Hex value={elt.get_txid()} label="TXID" />
            <Tooltip title="Go To The Spending Transaction">
                <IconButton
                    aria-label="goto-spending-txn"
                    onClick={() => dispatch(select_txn(elt.get_txid()))}
                >
                    <DoubleArrowIcon style={{ color: green[500] }} />
                </IconButton>
            </Tooltip>
        </div>
    ));
    const creator =
        !this_is_mock || is_confirmed ? null : (
            <Tooltip title="Create Contract">
                <IconButton
                    aria-label="create-contract"
                    onClick={() =>
                        dispatch(
                            create(opts.txn.tx, props.entity, props.contract)
                        )
                    }
                >
                    <AddCircleOutlineIcon style={{ color: green[500] }} />
                </IconButton>
            </Tooltip>
        );
    const check_exists =
        this_is_mock || is_confirmed ? null : (
            <Tooltip title="Check if Coin Exists">
                <IconButton
                    aria-label="check-coin-exists"
                    onClick={() => dispatch(fetch_utxo(outpoint))}
                >
                    <CloudDownloadIcon style={{ color: purple[500] }} />
                </IconButton>
            </Tooltip>
        );
    const title =
        opts.txn instanceof PhantomTransactionModel ? (
            <p>External UTXO</p>
        ) : (
            <PrettyAmountField amount={opts.utxo.amount} />
        );
    const obj = select_continuations(`${txid}:${idx}`);
    const continuations = obj
        ? Object.entries(obj).map(([k, v]) => {
              return <ContinuationOption key={k} v={v} />;
          })
        : null;
    const cont = continuations ? (
        <div>
            <Typography variant="h5" color={theme.palette.text.primary}>
                Continuations
            </Typography>
            {continuations}
        </div>
    ) : null;

    return (
        <div className="UTXODetail">
            <div>{flash}</div>
            <div>
                {creator}
                {check_exists}
            </div>
            {title}
            {cont}
            <OutputMetadataTable metadata={opts.metadata} />
            <OutpointDetail txid={txid} n={idx} />
            <ASM className="txhex" value={address} label="Address" />
            <ASM className="txhex" value={asm ?? 'UNKNOWN'} label="ASM" />
            {asm}
            <Typography variant="h5" color={theme.palette.text.primary}>
                Spent By
            </Typography>
            {spends}
        </div>
    );
}

function OutputMetadataTable(props: { metadata: UTXOFormatData }) {
    return (
        <>
            <Typography variant="h5">Metadata</Typography>
            <SIMPNeg12345
                simp_neg_12345={props.metadata.simp[-12345]}
            ></SIMPNeg12345>
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(props.metadata)
                        .filter(([k, _]) => k !== 'simp')
                        .map(([k, v]) => (
                            <tr key={k}>
                                <td>
                                    <Typography>{k}</Typography>
                                </td>
                                <td>
                                    <Typography>
                                        {typeof v === 'string'
                                            ? v
                                            : JSON.stringify(v)}
                                    </Typography>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </>
    );
}

function SIMPNeg12345(props: { simp_neg_12345?: any }) {
    let nft = null;
    if (props.simp_neg_12345) {
        nft = (
            <div>
                <img
                    style={{ maxWidth: '50%' }}
                    src={`https://${props.simp_neg_12345.cid}.ipfs.nftstorage.link`}
                ></img>
            </div>
        );
    }

    return nft;
}

function ContinuationOption(props: { v: Continuation }) {
    const [is_open, setOpen] = React.useState(false);
    const name = props.v.path.substr(props.v.path.lastIndexOf('/') + 1);
    const dispatch = useDispatch();

    return (
        <div>
            <Button onClick={() => setOpen(true)} variant="contained">
                {name}
            </Button>
            <Dialog open={is_open} onClose={() => setOpen(false)}>
                <DialogTitle>
                    <Typography variant="h5">{name}</Typography>
                    <ASM
                        className="txhex"
                        value={props.v.path}
                        label="Full Path"
                    />
                </DialogTitle>
                <DialogContent>
                    <MemoizeContForm {...props} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => dispatch(recreate_contract())}>
                        Recompile
                    </Button>
                    <Button onClick={() => setOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

const name_schema: JSONSchema7 = {
    title: 'Name for this Update',
    type: 'string',
};
const MemoizeContForm = React.memo(ContForm, (prev, next) => {
    return prev.v.path === next.v.path;
});
function ContForm(props: { v: Continuation }) {
    const dispatch = useDispatch();
    const form = React.useRef<any | null>(null);
    const name_form = React.useRef<any | null>(null);
    const this_effect_name = React.useRef('');
    const submit = (e: ISubmitEvent<any>) => {
        const name = this_effect_name.current;
        const data = e.formData;
        dispatch(add_effect_to_contract([props.v.path, name, data]));
    };
    const has_effect = useSelector((s: RootState) =>
        selectHasEffect(s, props.v.path)
    );
    const validate_name_unique = (
        data: string,
        errors: FormValidation
    ): FormValidation => {
        if (data === '') errors.addError('Name Required');
        if (hasOwn(has_effect, data)) errors.addError('Name Already Used');
        this_effect_name.current = data;
        return errors;
    };
    return (
        <div>
            <Form
                schema={name_schema}
                validate={validate_name_unique}
                liveValidate
                // NOTE: This is a bug documented here
                // https://github.com/rjsf-team/react-jsonschema-form/issues/2135
                // eslint-disable-next-line
                // @ts-ignore
                ref={name_form}
            >
                <div
                // Cancels native submit button
                ></div>
            </Form>
            <Form
                schema={props.v.schema}
                onSubmit={submit}
                // NOTE: This is a bug documented here
                // https://github.com/rjsf-team/react-jsonschema-form/issues/2135
                // eslint-disable-next-line
                // @ts-ignore
                ref={form}
            ></Form>
        </div>
    );
}
