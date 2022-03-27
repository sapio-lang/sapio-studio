import React from 'react';
import { BitcoinNodeManager } from '../Data/BitcoinNode';
import { WalletSendDialog } from './WalletSendDialog';
import { WalletSendForm } from './WalletSendForm';

export function WalletSend(props: {
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
