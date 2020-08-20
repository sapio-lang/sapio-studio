import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractModel } from '../Data/ContractManager';
import { TransactionDetail } from "../Detail/TransactionDetail";
import { UTXODetail } from "../Detail/UTXODetail";
import { TransactionModel } from '../Data/Transaction';
import { UTXOModel } from '../Data/UTXO';
import Modal from 'react-bootstrap/Modal';
import Collapse from 'react-bootstrap/Collapse';
import Tab from 'react-bootstrap/Tab';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import "./SideModal.css";
import ListGroup from 'react-bootstrap/ListGroup';
export interface Viewer {
}

export class EmptyViewer implements Viewer {

}
interface EntityViewerProps {
    broadcast: (a: Transaction) => Promise<any>;
    entity: Viewer;
    hide_details: () => void;
    current_contract: ContractModel;
}

export class EntityViewerModal extends React.Component<EntityViewerProps> {
    name() {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return "Transaction"
            case UTXOModel:
                return "Coin"
            default:
                return null;
        }
    }

    guts() {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return (<TransactionDetail
                    broadcast={this.props.broadcast}
                    entity={this.props.entity as TransactionModel}
                    find_tx_model={(a:Buffer, b:number) => this.props.current_contract.lookup(a,b)} />);
            case UTXOModel:
                return (<UTXODetail entity={this.props.entity as UTXOModel} />);
            default:
                return null;
        }
    }

    render() {
        return (
            <div className="EntityViewer">
                {this.guts()}
                <ListGroup >
                    <ListGroup.Item action onClick={() => this.props.hide_details()} variant="danger">
                        close
                    </ListGroup.Item>
                </ListGroup>
            </div>
        );
    }
}
