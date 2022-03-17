import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { Box } from '@mui/system';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { number } from 'bitcoinjs-lib/types/script';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { PrettyAmount } from '../util';
import './Wallet.css';

export function Wallet(props: { bitcoin_node_manager: BitcoinNodeManager }) {
    const [idx, set_idx] = React.useState(0);
    const handleChange = (_: any, idx: number) => {
        set_idx(idx);
    };
    return (
        <div className="Wallet">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={idx}
                    onChange={handleChange}
                    aria-label="basic tabs example"
                >
                    <Tab label="Send"></Tab>
                    <Tab label="Send History"></Tab>
                </Tabs>
            </Box>
            <Box sx={{ overflowY: 'scroll', height: '100%' }}>
                <WalletSend value={0} idx={idx} {...props}></WalletSend>
                <WalletHistory value={1} idx={idx} {...props}></WalletHistory>
            </Box>
        </div>
    );
}

function WalletSendDialog(props: {
    show: boolean;
    amt: number;
    to: string;
    close: () => void;
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    return (
        <Dialog
            open={props.show}
            onClose={() => {
                props.close();
            }}
        >
            <DialogTitle>Confirm Spend</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Confirm sending
                    {props.amt} BTC to {props.to}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => {
                        props.close();
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={async () => {
                        await props.bitcoin_node_manager.send_to_address(
                            props.amt,
                            props.to
                        );
                        props.close();
                    }}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
}
function WalletSendForm(props: {
    bitcoin_node_manager: BitcoinNodeManager;
    set_params: (a: number, b: string) => void;
}) {
    const [amount, setAmount] = React.useState(0);
    const [address, setAddress] = React.useState<string | null>(null);

    const get_address = async () => {
        try {
            const address = await props.bitcoin_node_manager.get_new_address();
            setAddress(address);
        } catch (err) {
            // console.error(err);
            setAddress(null);
        }
    };
    const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
        event
    ) => {
        event.preventDefault();
        const amt = event.currentTarget.amount.value;
        const to = event.currentTarget.address.value;
        props.set_params(amt, to);
        event.currentTarget.reset();
    };
    const show_address = address ? (
        <Typography>New Address: {address}</Typography>
    ) : (
        <Typography></Typography>
    );

    React.useEffect(() => {
        let cancel = false;
        const update = async () => {
            if (cancel) return;
            try {
                const amt = await props.bitcoin_node_manager.check_balance();
                setAmount(amt);
            } catch (err: any) {
                console.error(err);
                setAmount(0);
            }
            setTimeout(update, 5000);
        };

        update();
        return () => {
            cancel = true;
        };
    }, []);

    return (
        <div className="WalletSpendInner">
            <div></div>
            <div>
                <Typography>Amount: {amount}</Typography>
                {show_address}
                <Button onClick={() => get_address()}>Get Address</Button>
                <Box
                    component="form"
                    noValidate
                    autoComplete="off"
                    onSubmit={handleSubmit}
                >
                    <TextField
                        label="Address"
                        name="address"
                        type="text"
                        required={true}
                        size="small"
                    />
                    <TextField
                        label="Amount"
                        name="amount"
                        type="number"
                        required={true}
                        size="small"
                    />
                    <Button type="submit">Send</Button>
                </Box>
            </div>
            <div></div>
        </div>
    );
}
function WalletSend(props: {
    bitcoin_node_manager: BitcoinNodeManager;
    value: number;
    idx: number;
}) {
    const [params, set_params] = React.useState({ amt: -1, to: '' });
    return (
        <div className="WalletSpendOuter" hidden={props.idx !== props.value}>
            <WalletSendDialog
                amt={params.amt}
                to={params.to}
                show={params.amt >= 0 && params.to.length > 0}
                close={() => set_params({ amt: -1, to: '' })}
                bitcoin_node_manager={props.bitcoin_node_manager}
            ></WalletSendDialog>
            {props.idx === props.value && (
                <WalletSendForm
                    bitcoin_node_manager={props.bitcoin_node_manager}
                    set_params={(a, b) => set_params({ amt: a, to: b })}
                ></WalletSendForm>
            )}
        </div>
    );
}

type TxInfo = {
    involvesWatchonly: boolean; // (boolean) Only returns true if imported addresses were involved in transaction.
    address: string; // (string) The bitcoin address of the transaction.
    category: 'send' | 'receive' | 'generate' | 'immature' | 'orphan'; // (string) The transaction category.
    // "send"                  Transactions sent.
    // "receive"               Non-coinbase transactions received.
    // "generate"              Coinbase transactions received with more than 100 confirmations.
    // "immature"              Coinbase transactions received with 100 or fewer confirmations.
    // "orphan"                Orphaned coinbase transactions received.
    amount: number; // (numeric) The amount in BTC. This is negative for the 'send' category, and is positive
    // for all other categories
    label: string; // (string) A comment for the address/transaction, if any
    vout: number; // (numeric) the vout value
    fee: number; // (numeric) The amount of the fee in BTC. This is negative and only available for the
    // 'send' category of transactions.
    confirmations: number; // (numeric) The number of confirmations for the transaction. Negative confirmations means the
    // transaction conflicted that many blocks ago.
    generated: boolean; // (boolean) Only present if transaction only input is a coinbase one.
    trusted: boolean; // (boolean) Only present if we consider transaction to be trusted and so safe to spend from.
    blockhash: string; // (string) The block hash containing the transaction.
    blockheight: number; // (numeric) The block height containing the transaction.
    blockindex: number; // (numeric) The index of the transaction in the block that includes it.
    blocktime: number; // (numeric) The block time expressed in UNIX epoch time.
    txid: string; // (string) The transaction id.
    id: string;
    walletconflicts: string[]; // (json array) Conflicting transaction ids.
    // (string) The transaction id.
    time: number; // (numeric) The transaction time expressed in UNIX epoch time.
    timereceived: number; // (numeric) The time received expressed in UNIX epoch time.
    comment: string; // (string) If a comment is associated with the transaction, only present if not empty.
    'bip125-replaceable': string; // (string) ("yes|no|unknown") Whether this transaction could be replaced due to BIP125 (replace-by-fee);
    // may be unknown for unconfirmed transactions not in the mempool
    abandoned: boolean; // (boolean) 'true' if the transaction has been abandoned (inputs are respendable). Only available for the
    // 'send' category of transactions.
};
function WalletHistory(props: {
    bitcoin_node_manager: BitcoinNodeManager;
    value: number;
    idx: number;
}) {
    const [transactions, setTransactions] = React.useState<TxInfo[]>([]);
    React.useEffect(() => {
        let cancel = false;
        const update = async () => {
            if (cancel) return;

            try {
                const txns = await props.bitcoin_node_manager.list_transactions(
                    10
                );
                setTransactions(txns);
            } catch (err) {
                console.error(err);
                setTransactions([]);
            }
            setTimeout(update, 5000);
        };

        update();
        return () => {
            cancel = true;
        };
    }, []);

    const columns: GridColDef[] = [
        { field: 'amount', headerName: 'Amount', width: 130, type: 'number' },
        { field: 'category', headerName: 'Category', width: 130 },
        { field: 'txid', headerName: 'TXID', width: 130 },
        {
            field: 'blockheight',
            headerName: 'Height',
            width: 130,
            type: 'number',
        },
        {
            field: 'time',
            headerName: 'Time',
            width: 130,
            type: 'number',
            valueGetter: (params: GridValueGetterParams) => {
                const d: number = params.row.blocktime;
                return d ? new Date(d * 1000).toUTCString() : 'None';
            },
        },
    ];

    (transactions ?? []).forEach((v) => {
        v['id'] = v.txid;
    });
    return (
        <div
            className="WalletTransactionList"
            hidden={props.idx !== props.value}
        >
            {props.idx === props.value && (
                <>
                    <div></div>
                    <div>
                        <DataGrid
                            rows={transactions}
                            columns={columns}
                            pageSize={10}
                            rowsPerPageOptions={[5]}
                            disableColumnSelector
                            disableSelectionOnClick
                        />
                    </div>
                    <div></div>
                </>
            )}
        </div>
    );
}
