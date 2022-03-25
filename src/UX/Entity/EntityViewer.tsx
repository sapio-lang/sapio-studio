import { IconButton, Tooltip, useTheme } from '@mui/material';
import { red } from '@mui/material/colors';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import React from 'react';
import { useDispatch } from 'react-redux';
import { ContractModel } from '../../Data/ContractManager';
import { TransactionDetail } from './Detail/TransactionDetail';
import { UTXODetail } from './Detail/UTXODetail';
import { deselect_entity } from './EntitySlice';
import './EntityViewer.css';
import Color from 'color';

interface CurrentylViewedEntityProps {
    current_contract: ContractModel;
}

export function CurrentlyViewedEntity(props: CurrentylViewedEntityProps) {
    const theme = useTheme();
    const dispatch = useDispatch();
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

    return (
        <div
            className="EntityViewerFrame"
            style={{
                backgroundColor: Color(theme.palette.background.default)
                    .fade(0.2)
                    .toString(),
            }}
        >
            <div className="EntityViewerResize" onMouseDown={onMouseDown}></div>
            <div>
                <Tooltip title="Close Entity Viewer">
                    <IconButton
                        aria-label="close-entity-viewer"
                        onClick={() => dispatch(deselect_entity())}
                    >
                        <CancelOutlinedIcon style={{ color: red[500] }} />
                    </IconButton>
                </Tooltip>
                <div
                    className="EntityViewer"
                    style={{
                        width: width,
                    }}
                >
                    <TransactionDetail
                        current_contract={props.current_contract}
                        find_tx_model={(a: Buffer, b: number) =>
                            props.current_contract.lookup_utxo_model(a, b)
                        }
                    />
                    <UTXODetail contract={props.current_contract} />
                </div>
            </div>
        </div>
    );
}
