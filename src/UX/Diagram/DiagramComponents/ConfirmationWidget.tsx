import * as React from 'react';
import { TransactionState } from './TransactionNode/TransactionNodeModel';
import { useTheme } from '@mui/material';
import { TXID } from '../../../util';
import { selectStatus } from '../../../Data/DataSlice';
import { useSelector } from 'react-redux';
import { ContractModel } from '../../../Data/ContractManager';

export function ConfirmationWidget(props: { t: TXID; cm: ContractModel }) {
    const status = useSelector(selectStatus(props.t));
    const theme = useTheme();
    switch (status) {
        case undefined:
        case null:
        case 'Confirmed': {
            return null;
        }
        case 'InMempool': {
            return (
                <div
                    style={{
                        background: theme.palette.info.light,
                        color: theme.palette.info.contrastText,
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
        case 'Impossible': {
            return (
                <div
                    style={{
                        background: theme.palette.error.light,
                        color: theme.palette.error.contrastText,
                        textAlign: 'center',
                    }}
                >
                    Conflicted
                </div>
            );
        }
    }
}
