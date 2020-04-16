import React from 'react';
import { TransactionDetail } from "./TransactionDetail";
import { UTXODetail } from "./UTXODetail";
export class EntityViewer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        switch (this.props.entity.type) {
            case "txn":
                return (<TransactionDetail
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer}
                    find_tx_model={this.props.current_contract.lookup} />);
            case "utxo":
                return (<UTXODetail
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer} />)
            default:
                return null;
        }
    }
}
