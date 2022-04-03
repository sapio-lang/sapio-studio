import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';

export function WalletSendDialog(props: {
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
