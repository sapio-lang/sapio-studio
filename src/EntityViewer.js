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
        switch (this.props.entity.type) {
            case "txn":
                return (<TransactionComponent
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer}
                    find_tx_model={(txid, n) => {
                        const idx = this.props.current_contract.txid_map.get(hash_to_hex(txid));
                        if (idx === undefined)
                            return null;
                        return this.props.current_contract.txn_models[idx].utxo_models[n];
                    }} />

                );
            case "utxo":
                return (<UTXOComponent
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer} />)
            default:
                return null;
        }
    }
}
