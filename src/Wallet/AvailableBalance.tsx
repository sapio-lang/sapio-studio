import { Typography } from '@mui/material';
import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';

export function AvailableBalance(props: {
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    const [amount, setAmount] = React.useState(0);
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
    return <Typography>Amount: {amount}</Typography>;
}
