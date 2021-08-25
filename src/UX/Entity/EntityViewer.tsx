import React from 'react';
import { ContractModel, Data } from '../../Data/ContractManager';
import { TransactionDetail } from './Detail/TransactionDetail';
import { UTXODetail } from './Detail/UTXODetail';
import { TransactionModel } from '../../Data/Transaction';
import { UTXOModel } from '../../Data/UTXO';
import './EntityViewer.css';
import Button from 'react-bootstrap/esm/Button';
export interface ViewableEntityInterface {}

export class EmptyViewer implements ViewableEntityInterface {}

interface CurrentylViewedEntityProps {
    entity: ViewableEntityInterface;
    hide_details: () => void;
    current_contract: ContractModel;
}

interface EntityViewerState {
    width: string;
}

export class CurrentlyViewedEntity extends React.Component<
    CurrentylViewedEntityProps,
    EntityViewerState
> {
    listener: any | null;
    constructor(props: CurrentylViewedEntityProps) {
        super(props);
        this.listener = null;
        this.state = {
            width: '20em',
        };
    }
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

    guts(): null | React.ReactElement {
        switch (this.props.entity.constructor) {
            case TransactionModel:
                return (
                    <TransactionDetail
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
                        contract={this.props.current_contract}
                    />
                );
            default:
                return null;
        }
    }
    mmu: undefined | ((ev: MouseEvent) => void);
    mmm: undefined | ((ev: MouseEvent) => void);
    onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        this.mmm = this.onMouseMove.bind(this);
        this.mmu = this.onMouseUp.bind(this);
        document.addEventListener('mousemove', this.mmm);
        document.addEventListener('mouseup', this.mmu);
    };
    onMouseUp(e: MouseEvent) {
        e.preventDefault();
        if (this.mmm) document.removeEventListener('mousemove', this.mmm);
        if (this.mmu) document.removeEventListener('mouseup', this.mmu);
        this.mmm = undefined;
        this.mmu = undefined;
    }
    onMouseMove(e: MouseEvent) {
        e.preventDefault();
        const width = (window.innerWidth - e.clientX).toString() + 'px';
        this.setState({ width });
    }
    render() {
        return (
            <div className="EntityViewerFrame">
                <div
                    className="EntityViewerResize"
                    onMouseDown={this.onMouseDown.bind(this)}
                ></div>
                <div>
                    <Button
                        onClick={() => this.props.hide_details()}
                        variant="link"
                    >
                        <span
                            className="glyphicon glyphicon-remove"
                            style={{ color: 'red' }}
                        ></span>
                    </Button>
                    <div
                        className="EntityViewer"
                        style={{
                            width: this.state.width,
                        }}
                    >
                        {this.guts()}
                    </div>
                </div>
            </div>
        );
    }
}
