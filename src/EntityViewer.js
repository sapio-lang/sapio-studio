import React from 'react';
import { hash_to_hex } from './Hex';
import { TransactionComponent } from './Transaction';
import { UTXOComponent } from './UTXO';
export class EntityViewer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const transaction_component = this.props.entity.type === "txn" ?
            <TransactionComponent entity={this.props.entity} hide_details={this.props.hide_details} update={this.props.update_viewer} find_tx_model={(txid, n) => {
                const idx = this.props.current_contract.txid_map.get(hash_to_hex(txid));
                if (idx === undefined)
                    return null;
                return this.props.current_contract.txn_models[idx].utxo_models[n];
            }} />
            : null;
        const utxo_component = this.props.entity.type === "utxo" ?
            <UTXOComponent entity={this.props.entity} hide_details={this.props.hide_details} update={this.props.update_viewer} />
            : null;
        return (<>
            {transaction_component}
            {utxo_component}
        </>);
    }
}
