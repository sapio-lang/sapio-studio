import React from 'react';
import { TransactionDetail } from "./Detail/TransactionDetail";
import { UTXODetail } from "./Detail/UTXODetail";
import { Transaction } from 'bitcoinjs-lib';
import { TransactionModel } from './Transaction';
import { UTXOModel } from './UTXO';
import {ContractModel} from './ContractManager';
export interface Viewer {
}
interface UpdateMessage {
    entity: Viewer;
    isSelected: boolean;
}
interface EntityViewerProps {
    broadcast: (a: Transaction) => Promise<any>;
    entity: Viewer;
    hide_details: () => void;
    update_viewer: (a: UpdateMessage) => void;
    current_contract: ContractModel;
}

export class EntityViewer extends React.Component<EntityViewerProps> {
    render() {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return (<TransactionDetail
                    broadcast={this.props.broadcast}
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer}
                    find_tx_model={this.props.current_contract.lookup} />);
            case UTXOModel:
                return (<UTXODetail
                    entity={this.props.entity}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer} />)
            default:
                return null;
        }
    }
}
