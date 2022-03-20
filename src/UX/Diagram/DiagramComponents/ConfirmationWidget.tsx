import * as React from 'react';
import { TransactionState } from './TransactionNode/TransactionNodeModel';
import { useTheme } from '@mui/material';

export function ConfirmationWidget(props: { t: TransactionState }) {
    const theme = useTheme();
    switch (props.t) {
        case 'Confirmed': {
            return null;
        }
        case 'InMempool': {
            return (
                <div
                    style={{
                        background: theme.palette.info.light,
                        color: theme.palette.warning.contrastText,
                        textAlign: 'center',
                    }}
                >
                    In Mempool
                </div>
            );
        }
        case 'Unknown':
        case 'Broadcastable':
        case 'NotBroadcastable': {
            return (
                <div
                    style={{
                        background: theme.palette.warning.light,
                        color: theme.palette.warning.contrastText,
                        textAlign: 'center',
                    }}
                >
                    UNCONFIRMED
                </div>
            );
        }
        default:
            return <div>Internal Error</div>;
    }
}
