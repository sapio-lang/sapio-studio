import styled from '@emotion/styled';
import { DefaultPortLabel, DefaultPortModel } from '@projectstorm/react-diagrams';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as _ from 'lodash';
import * as React from 'react';
import './Ants.css';
import { TransactionNodeModel } from './TransactionNodeModel';
import Color from 'color';
//import { css } from '@emotion/core';


//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
export const Node = styled.div<{ background: string; selected: boolean; confirmed: boolean}>`
font-family: sans-serif;
color: white;
overflow: visible;
font-size: 11px;
box-shadow: ${p => (p.selected ? '4px 1px 10px rgba(0,192,255,0.5)': 'none')};
border-radius: 5px 20px;
`;
// border-radius: 5px 25px;
// background-color: ${p => p.background};
// border: 2px solid transparent;
// background: ${p => {
//     const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
//     return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
// }};
// animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};

export const Title = styled.div<{color: string}>`
background: ${p => (p.color)};
display: flex;
white-space: nowrap;
justify-items: center;
`;

export const TitleName = styled.div`
flex-grow: 1;
padding: 5px 5px;
`;

export const PortsTop = styled.div<{color:string}>`
display: flex;
background-color: ${p => p.color};
border-radius: 5px 25px 0px 0px;
color: black;
`;

export const PortsBottom = styled.div<{color: string}>`
display: flex;
border-radius: 0 0 5px 25px;
background-color: ${p => p.color};
color: white;
`;
// background-image: linear-gradient(rgba(255,255,255,1), rgba(255, 255, 255,1));

export const PortsContainer = styled.div`
flex-grow: 1;
display: flex;
flex-direction: row;

&:first-of-type {
    margin-right: 10px;
}

&:only-child {
    margin-right: 0px;
}
`;

/**
 * Marching ants border
 */


export interface DefaultNodeProps {
	node: TransactionNodeModel ;
	engine: DiagramEngine;
}

/**
 * Default node that models the CustomNodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export class TransactionNodeWidget extends React.Component<DefaultNodeProps> {
	generatePort = (port :DefaultPortModel) => {
		return <DefaultPortLabel engine={this.props.engine} port={port} key={port.getID()} />;
	};

	render() {
		let color = Color(this.props.node.color).alpha(0.2).toString();
		let white = Color("white").fade(0.2).toString();
		let black = Color("black").fade(0.2).toString();
		let yellow = Color("yellow").fade(0.2).toString();
		const is_conf = this.props.node.isConfirmed() ? null: <div style={{background: yellow, color:"black", textAlign: "center"}}>UNCONFIRMED</div>;
		return (
			<Node
				data-default-node-name={this.props.node.name}
				selected={this.props.node.isSelected()}
				confirmed={this.props.node.isConfirmed()}
				background={this.props.node.color}>
				<PortsTop color={white}>
					<PortsContainer>{_.map(this.props.node.getInPorts(), this.generatePort)}</PortsContainer>
				</PortsTop>
				<Title color={color}>
					<TitleName>Transaction</TitleName>
					<TitleName>{this.props.node.name}</TitleName>
				</Title>
				{is_conf}
				<Title color={color}>
					<TitleName>{this.props.node.purpose}</TitleName>
				</Title>
				<PortsBottom color={black}>
					<PortsContainer>{_.map(this.props.node.getOutPorts(), this.generatePort)}</PortsContainer>
				</PortsBottom>
			</Node>
		);
	}
}

