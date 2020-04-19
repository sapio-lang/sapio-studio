import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractModel } from './ContractManager';
import { TransactionDetail } from "./Detail/TransactionDetail";
import { UTXODetail } from "./Detail/UTXODetail";
import { TransactionModel } from './Transaction';
import { UTXOModel } from './UTXO';
export interface Viewer {
}

export class EmptyViewer implements Viewer {

}
export interface UpdateMessage {
    entity: Viewer;
    isSelected?: boolean;
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
                    entity={this.props.entity as TransactionModel}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer}
                    find_tx_model={(a:Buffer, b:number) => this.props.current_contract.lookup(a,b)} />);
            case UTXOModel:
                return (<UTXODetail
                    entity={this.props.entity as UTXOModel}
                    hide_details={this.props.hide_details}
                    update={this.props.update_viewer} />)
            default:
                return null;
        }
    }
}
