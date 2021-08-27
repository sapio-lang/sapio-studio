import React from 'react';
import { ContractModel, Data } from '../../Data/ContractManager';
import { TransactionDetail } from './Detail/TransactionDetail';
import { UTXODetail } from './Detail/UTXODetail';
import { TransactionModel } from '../../Data/Transaction';
import { UTXOModel } from '../../Data/UTXO';
import './EntityViewer.css';
import Button from 'react-bootstrap/esm/Button';
import { OutpointInterface, TXID } from '../../util';
import { useDispatch, useSelector } from 'react-redux';
import { deselect_entity, selectEntityToView } from './EntitySlice';
export interface ViewableEntityInterface {}

export class EmptyViewer implements ViewableEntityInterface {}

interface CurrentylViewedEntityProps {
    current_contract: ContractModel;
}

export function CurrentlyViewedEntity(props: CurrentylViewedEntityProps) {
    const [width, setWidth] = React.useState('20em');
    const onMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const width = (window.innerWidth - e.clientX).toString() + 'px';
        setWidth(width);
    };
    const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const entity_id: TXID | OutpointInterface | null = useSelector(
        selectEntityToView
    );
    let entity: ViewableEntityInterface = new EmptyViewer();
    if (entity_id) {
        if (typeof entity_id === 'string') {
            entity =
                props.current_contract.txid_map.get_by_txid_s(
                    entity_id as string
                ) ?? entity;
        } else {
            entity =
                props.current_contract.lookup_utxo_model(
                    (entity_id as OutpointInterface).hash,
                    (entity_id as OutpointInterface).index
                ) ?? entity;
        }
    }

    let guts = null;
    switch (entity.constructor) {
        case TransactionModel:
            guts = (
                <TransactionDetail
                    entity={entity as TransactionModel}
                    find_tx_model={(a: Buffer, b: number) =>
                        props.current_contract.lookup_utxo_model(a, b)
                    }
                />
            );
            break;
        case UTXOModel:
            guts = (
                <UTXODetail
                    entity={entity as UTXOModel}
                    contract={props.current_contract}
                />
            );

            break;
    }
    const dispatch = useDispatch();
    return (
        <div className="EntityViewerFrame">
            <div className="EntityViewerResize" onMouseDown={onMouseDown}></div>
            <div>
                <Button
                    onClick={() => dispatch(deselect_entity())}
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
                        width: width,
                    }}
                >
                    {guts}
                </div>
            </div>
        </div>
    );
}
