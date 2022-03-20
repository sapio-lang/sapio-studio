import styled from '@emotion/styled';
import {
    DefaultPortLabel,
    DefaultPortModel,
} from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import Color from 'color';
import * as _ from 'lodash';
import * as React from 'react';
import { PrettyAmount } from '../../../../util';
import './Ants.css';
import { UTXONodeModel } from './UTXONodeModel';
import { BaseEvent } from '@projectstorm/react-canvas-core';
import { UTXOModel } from '../../../../Data/UTXO';
import { useSelector } from 'react-redux';
import { selectIsReachable } from '../../../../Data/SimulationSlice';
import { useTheme } from '@mui/material';
import { EntityType, selectEntityToView } from '../../../Entity/EntitySlice';
import { selectContinuation } from '../../../ContractCreator/ContractCreatorSlice';
import { ConfirmationWidget } from '../ConfirmationWidget';
const white = Color('white').toString();
const black = Color('black').toString();
const yellow = Color('yellow').fade(0.2).toString();
//import { css } from '@emotion/core';

//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
// border-radius: 50%;
// height: 0;
// width: 150%;
// padding-bottom:150%;
const UTXONode = styled.div<{ selected: boolean }>`
    color: white;
    overflow: hidden;
    font-size: 11px;
    border-radius: 25%;
    box-shadow: ${(p) =>
        p.selected ? '4px 1px 10px rgba(0,192,255,0.5)' : 'none'};
    &.unreachable:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        background: rgba(0, 0, 0, 0.7);
        box-shadow: 0px 0px 25px rgba(0, 0, 0, 0.9);
        border-radius: 25%;
        background-clip: border-box;
    }
`;
//border: 2px solid transparent;
//background: ${p => {
//    const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
//    return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
//}};
//animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};

const Title = styled.div<{ color: string; textColor: string }>`
    background: ${(p) => p.color};
    color: ${(p) => p.textColor};
    display: flex;
    width: 100%;
    white-space: nowrap;
    justify-items: center;
    text-align: center;
`;

const TitleName = styled.div`
    flex-grow: 1;
    padding: 5px 5px;
`;

const PortsTop = styled.div<{ color: string; textColor: string }>`
    display: flex;
    color: ${(p) => p.textColor};
    background-color: ${(p) => p.color};
`;

const PortsBottom = styled.div<{ color: string; textColor: string }>`
    display: flex;
    background: ${(p) => p.color};
    color: ${(p) => p.textColor};
`;

interface PortsContainer2Props {
    children: React.ReactNode[];
}
class PortsContainerUTXOTop extends React.Component<PortsContainer2Props> {
    render() {
        return (
            <div className="PortsContainerUTXOTop">{this.props.children}</div>
        );
    }
}
class PortsContainerUTXOBottom extends React.Component<PortsContainer2Props> {
    render() {
        return (
            <div className="PortsContainerUTXOBottom">
                {this.props.children}
            </div>
        );
    }
}

/**
 * Marching ants border
 */

interface DefaultNodeProps {
    node: UTXONodeModel;
    engine: DiagramEngine;
}

/**
 * Default node that models the UTXONodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
//node: HTMLDivElement | null;
//callback: () => any;
export function UTXONodeWidget(props: DefaultNodeProps) {
    const selected_entity_id: EntityType = useSelector(selectEntityToView);
    const has_continuations =
        Object.keys(
            useSelector(selectContinuation)(
                `${props.node.getOptions().txid}:${
                    props.node.getOptions().index
                }`
            ) ?? {}
        ).length > 0;
    const [id, setID] = React.useState(Math.random());
    const is_reachable = useSelector(selectIsReachable)(
        props.node.getOptions().txid
    );
    const [amount, setAmount] = React.useState(props.node.getAmount());
    React.useEffect(() => {
        const l = props.node.registerListener({
            sync: (e: BaseEvent) =>
                setAmount((props.node as UTXOModel).getAmount()),
        });
        return () => {
            props.node.deregisterListener(l);
        };
    });
    const generatePort = (port: DefaultPortModel) => {
        return (
            <DefaultPortLabel
                engine={props.engine}
                port={port}
                key={port.getID()}
            />
        );
    };
    const ports_in = _.map(props.node.getInPorts(), generatePort);
    const ports_out = _.map(props.node.getOutPorts(), generatePort);
    const theme = useTheme();
    const textColor = theme.palette.text.primary;
    const ports_top =
        ports_in.length === 0 ? null : (
            <PortsTop key="ports" color={'transparent'} textColor={textColor}>
                <PortsContainerUTXOTop key="inputs">
                    {ports_in}
                </PortsContainerUTXOTop>
            </PortsTop>
        );
    const ports_bottom =
        ports_out.length === 0 ? null : (
            <PortsBottom
                color={theme.palette.secondary.light}
                textColor={theme.palette.secondary.contrastText}
            >
                <PortsContainerUTXOBottom key="outputs">
                    {ports_out}
                </PortsContainerUTXOBottom>
            </PortsBottom>
        );

    const is_continuable = !has_continuations ? null : (
        <div
            style={{
                background: theme.palette.info.light,
                color: theme.palette.info.contrastText,
                textAlign: 'center',
            }}
        >
            UPDATABLE
        </div>
    );

    const reachable_cl = is_reachable ? 'reachable' : 'unreachable';
    const colorObj = Color(props.node.getOptions().color);
    const color = colorObj.alpha(0.2).toString();
    const opts = props.node.getOptions();
    const is_selected =
        selected_entity_id[0] === 'UTXO' &&
        selected_entity_id[1].hash === opts.txid &&
        selected_entity_id[1].nIn === opts.index;
    return (
        <div>
            {ports_top}
            <div style={{ position: 'relative' }}>
                <UTXONode
                    data-default-utxonode-name={props.node.getOptions().name}
                    key={id}
                    selected={is_selected}
                    className={reachable_cl}
                >
                    <Title color={color} textColor={textColor}>
                        <TitleName>{props.node.getOptions().name}</TitleName>
                    </Title>
                    {is_continuable}
                    <ConfirmationWidget t={props.node.getOptions().txid} />
                    <Title color={color} textColor={textColor}>
                        <TitleName>{PrettyAmount(amount)}</TitleName>
                    </Title>
                    {ports_bottom}
                </UTXONode>
            </div>
        </div>
    );
}
