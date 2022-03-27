import { Button, TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { AvailableBalance } from './AvailableBalance';

export function WalletSendForm(props: {
    bitcoin_node_manager: BitcoinNodeManager;
    set_params: (a: number, b: string) => void;
}) {
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

    return (
        <div className="WalletSpendInner">
            <div></div>
            <div>
                <AvailableBalance
                    bitcoin_node_manager={props.bitcoin_node_manager}
                />
                <Typography>{address && `New Address: ${address}`}</Typography>
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
