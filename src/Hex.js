
import { DefaultNodeModel } from '@projectstorm/react-diagrams';
import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import Button from 'react-bootstrap/Button';
import Collapse from 'react-bootstrap/Collapse';
export default class Hex extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (<code className="txhex truncate" onClick={this.props.onClick}>{this.props.value} </code>)
    }
}
export function hash_to_hex(h) {
    const b = new Buffer(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
};
