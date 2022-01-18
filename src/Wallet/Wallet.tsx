import { Button, TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import './Wallet.css';

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
export function Wallet(props: { bitcoin_node_manager: BitcoinNodeManager }) {
    const [amount, setAmount] = React.useState(0);
    const [address, setAddress] = React.useState<string | null>(null);
    const [transactions, setTransactions] = React.useState<TxInfo[]>([]);

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

            try {
                const txns = await props.bitcoin_node_manager.list_transactions(10);
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
        await props.bitcoin_node_manager.send_to_address(
            event.currentTarget.amount.value,
            event.currentTarget.address.value
        );
    };
    const show_address = address ? (
        <Typography>{address}</Typography>
    ) : (
        <Typography></Typography>
    );

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
        <div className="Wallet">
            <div className="WalletSpend">
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
            <div className="WalletTransactionList">
                <div></div>
                <div>
                    <DataGrid
                        rows={transactions}
                        columns={columns}
                        pageSize={5}
                        rowsPerPageOptions={[5]}
                        checkboxSelection
                    />
                </div>
                <div></div>
            </div>
        </div>
    );
}
