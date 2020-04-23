import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractModel } from './ContractManager';
import { TransactionDetail } from "./Detail/TransactionDetail";
import { UTXODetail } from "./Detail/UTXODetail";
import { TransactionModel } from './Transaction';
import { UTXOModel } from './UTXO';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import "./SideModal.css";
export interface Viewer {
}

export class EmptyViewer implements Viewer {

}
interface EntityViewerProps {
    broadcast: (a: Transaction) => Promise<any>;
    entity: Viewer;
    hide_details: () => void;
    current_contract: ContractModel;
    show: boolean;
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

        return (<Modal show={this.props.show} onHide={this.props.hide_details} size="lg" className="modal-right"
        backdropClassName="modal-bright-backdrop">
            <Modal.Header closeButton>
                <Modal.Title> {this.name()} Details </Modal.Title>
            </Modal.Header>
            {this.guts()}
            <Modal.Footer>
                <Button variant="secondary" onClick={this.props.hide_details}> Close </Button>
            </Modal.Footer>
        </Modal>);
    }
    }
