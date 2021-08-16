import { Transaction } from 'bitcoinjs-lib';
import React from 'react';
import { ContractModel, Data } from '../../Data/ContractManager';
import { TransactionDetail } from './Detail/TransactionDetail';
import { UTXODetail } from './Detail/UTXODetail';
import { TransactionModel } from '../../Data/Transaction';
import { UTXOModel } from '../../Data/UTXO';
import './EntityViewer.css';
import ListGroup from 'react-bootstrap/ListGroup';
import { TXID } from '../../util';
import { QueriedUTXO } from '../../Data/BitcoinNode';
import Button from 'react-bootstrap/esm/Button';
export interface ViewableEntityInterface {}

export class EmptyViewer implements ViewableEntityInterface {}
interface CurrentylViewedEntityProps {
    broadcast: (a: Transaction) => Promise<any>;
    fetch_utxo: (t: TXID, n: number) => Promise<QueriedUTXO>;
    fund_out: (a: Transaction) => Promise<Transaction>;
    entity: ViewableEntityInterface;
    hide_details: () => void;
    current_contract: ContractModel;
    load_new_contract: (x: Data) => void;
}

export class CurrentlyViewedEntity extends React.Component<CurrentylViewedEntityProps> {
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
            <>
                <Button
                    onClick={() => this.props.hide_details()}
                    variant="link"
                >
                    <span
                        className="glyphicon glyphicon-remove"
                        style={{ color: 'red' }}
                    ></span>
                </Button>
                <div className="EntityViewer">{this.guts()}</div>
            </>
        );
    }
}
