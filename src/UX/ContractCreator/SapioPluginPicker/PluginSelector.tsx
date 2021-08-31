import React from 'react';
import Button from 'react-bootstrap/Button';
import './PluginSelector.css';
import { Plugin, PluginTile } from './PluginTile';
import { PluginForm } from './PluginForm';
interface IProps {
    applications: Map<string, Plugin>;
    hide: () => void;
}
interface IState {
    selected: string | null;
}
export class PluginSelector extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            selected: null,
        };
    }
    deselect() {
        this.setState({ selected: null });
    }
    select(key: string) {
        this.setState({ selected: key });
    }
    render() {
        console.log(this.props.applications);
        let tiles = Array.from(this.props.applications, ([name, app], i) => (
            <PluginTile app={app} parent={this} />
        ));
        if (this.state.selected === null) {
            return (
                <div className="PluginSelectorGrid">
                    <div className="back"></div>
                    <div className={'middle'}>{tiles}</div>
                    <div className="forward"></div>
                </div>
            );
        } else {
            return (
                <div>
                    <div style={{ textAlign: 'right', paddingRight: '20px' }}>
                        <a onClick={() => this.deselect()}>
                            <span className="glyphicon glyphicon-arrow-left"></span>
                        </a>
                    </div>
                    <PluginForm
                        app={this.props.applications.get(this.state.selected)!}
                        hide={this.props.hide}
                        deselect={this.deselect.bind(this)}
                    />
                </div>
            );
        }
    }
}
