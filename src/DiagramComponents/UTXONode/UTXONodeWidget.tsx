import styled from '@emotion/styled';
import { DefaultPortLabel, DefaultPortModel } from '@projectstorm/react-diagrams';
import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams-core';
import * as _ from 'lodash';
import * as React from 'react';
import './Ants.css';
import { UTXONodeModel } from './UTXONodeModel';
import { pretty_amount } from '../../util';
import Color from 'color';
//import { css } from '@emotion/core';


//border: solid 2px ${p => (p.selected ? 'rgb(0,192,255)' : 'white')};
// border-radius: 50%;
// height: 0;
// width: 150%;
// padding-bottom:150%;
const UTXONode = styled.div<{ selected: boolean; confirmed: boolean}>`
font-family: sans-serif;
color: white;
overflow: visible;
font-size: 11px;
box-shadow: ${p => (p.selected ? '4px 1px 10px rgba(0,192,255,0.5)': 'none')};
border-radius: 25px 5px;
`;
//border: 2px solid transparent;
//background: ${p => {
//    const ants_color = p.selected ? 'rgba(0,192,255,0.5)': 'transparent';
//    return (!p.confirmed? 'linear-gradient('+p.background +','+ p.background+') padding-box, repeating-linear-gradient(-45deg, black 0, black 25%, '+ants_color+' 0, '+ants_color+' 50%) 0 / 1em 1em' : '')
//}};
//animation: ${p => !p.confirmed? "ants 12s linear infinite" : "none"};

const Title = styled.div<{color: string}>`
background: ${p => (p.color)};
display: flex;
width:100%;
white-space: nowrap;
justify-items: center;
text-align:center;
`;

const TitleName = styled.div`
flex-grow: 1;
padding: 5px 5px;
`;

const PortsTop = styled.div<{color: string}>`
display: flex;
border-radius: 25px 5px 0px 0px;
background-color: ${p=>p.color};
color: white;

border-top: 5px solid black;
border-left: 5px solid black;
`;

const PortsBottom = styled.div<{color: string}>`
display: flex;
border-radius: 0 0 25px 5px;
background-color: ${p=>p.color};
color: black;

border-bottom: 5px solid white;
border-right: 5px solid white;
`;

const PortsContainer = styled.div`
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
interface PortsContainer2Props {
	children: React.ReactNode[]
}
class PortsContainer2 extends React.Component<PortsContainer2Props> {
	render() {
		let n = React.Children.count(this.props.children);
		n = Math.ceil(Math.sqrt(n));
		let pct = Math.round((1.0/n) * 100).toString() + "%";
		let arg = "1 1 " + pct;
		let rows = this.props.children.map((child: any) =>
			(<div style={{flex: arg }}>{child}</div>)
		);
		return (
			<div  style={{flexDirection:"row", display: "flex", flexWrap: "wrap"}}>
			{rows}
			</div>
		);

	}
}

/**
 * Marching ants border
 */


interface DefaultNodeProps {
	node: UTXONodeModel ;
	engine: DiagramEngine;
}

/**
 * Default node that models the UTXONodeModel. It creates two columns
 * for both all the input ports on the left, and the output ports on the right.
 */
export class UTXONodeWidget extends React.Component<DefaultNodeProps> {
    node: HTMLDivElement | null;
    callback: () => any;
	mounted: boolean;
	id: number;
    constructor(props:any) {
        super(props);
        this.node = null;
		this.mounted=false;
		this.id = Math.random()
        this.callback = () =>
        {
			if (this.node === null) return;

		}
    }
	generatePort = (port :DefaultPortModel) => {
		return <DefaultPortLabel engine={this.props.engine} port={port} key={port.getID()} />;
	};

	componentDidMount() {
		this.mounted = true;
		this.callback();
	}

	componentWillUnmount() {
		this.mounted = false;
	}

	render() {
		const ports_in = _.map(this.props.node.getInPorts(), this.generatePort);
		const ports_out = _.map(this.props.node.getOutPorts(), this.generatePort);
		let color = Color(this.props.node.getOptions().color).alpha(0.2).toString();
		let white = Color("white").toString();
		let black = Color("black").toString();
		const ports_top = ports_in.length == 0 ? null : (

				<PortsTop key="ports" color ={black}>
					<PortsContainer2 key="inputs">{ports_in}</PortsContainer2>
				</PortsTop>
		);
		const ports_bottom = ports_out.length === 0? null :(	<PortsBottom color={white}>
					<PortsContainer2 key="outputs">{ports_out}</PortsContainer2>
				</PortsBottom>);

		let yellow = Color("yellow").fade(0.2).toString();
		const is_conf = this.props.node.isConfirmed() ? null: <div style={{background: yellow, color:"black", textAlign: "center"}}>UNCONFIRMED</div>;


		return (
			<UTXONode
				ref={(node) => this.node = node}
				data-default-utxonode-name={this.props.node.getOptions().name}
				key={this.id}
				selected={this.props.node.isSelected()}
				confirmed={this.props.node.isConfirmed()}>
					{ports_top}
				<Title color={color}>
					<TitleName>{this.props.node.getOptions().name}</TitleName>
				</Title>
				{is_conf}
				<Title color={color}>
					<TitleName>{pretty_amount(this.props.node.getOptions().amount)}</TitleName>
				</Title>
					{ports_bottom}
						</UTXONode>
		);
	}
}

            /*
            */
