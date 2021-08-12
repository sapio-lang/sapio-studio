import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractModel, Data } from '../Data/ContractManager';
import { TransactionDetail } from '../Detail/TransactionDetail';
import { UTXODetail } from '../Detail/UTXODetail';
import { TransactionModel } from '../Data/Transaction';
import { UTXOModel } from '../Data/UTXO';
import './EntityViewer.css';
import ListGroup from 'react-bootstrap/ListGroup';
import { TXID } from '../util';
export interface Viewer {}

export class EmptyViewer implements Viewer {}
interface EntityViewerProps {
    broadcast: (a: Transaction) => Promise<any>;
    fetch_utxo: (t: TXID, n: number) => Promise<any>;
    fund_out: (a: Transaction) => Promise<Transaction>;
    entity: Viewer;
    hide_details: () => void;
    current_contract: ContractModel;
    load_new_contract: (x: Data) => void;
}

export class EntityViewerModal extends React.Component<EntityViewerProps> {
    name() {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return 'Transaction';
            case UTXOModel:
                return 'Coin';
            default:
                return null;
        }
    }

    guts() {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return (
                    <TransactionDetail
                        broadcast={this.props.broadcast}
                        entity={this.props.entity as TransactionModel}
                        find_tx_model={(a: Buffer, b: number) =>
                            this.props.current_contract.lookup(a, b)
                        }
                    />
                );
            case UTXOModel:
                return (
                    <UTXODetail
                        entity={this.props.entity as UTXOModel}
                        fund_out={this.props.fund_out}
                        fetch_utxo={this.props.fetch_utxo}
                        contract={this.props.current_contract}
                        load_new_contract={this.props.load_new_contract}
                    />
                );
            default:
                return null;
        }
    }

    render() {
        return (
            <div className="EntityViewer">
                {this.guts()}
                <ListGroup>
                    <ListGroup.Item
                        action
                        onClick={() => this.props.hide_details()}
                        variant="danger"
                    >
                        close
                    </ListGroup.Item>
                </ListGroup>
            </div>
        );
    }
}
