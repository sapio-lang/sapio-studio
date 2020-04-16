import React from 'react';
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
                    find_tx_model={this.props.current_contract.lookup} />);
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
