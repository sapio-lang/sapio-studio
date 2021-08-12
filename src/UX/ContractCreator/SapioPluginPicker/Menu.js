import React from 'react';
import { PluginSelector } from './PluginSelector';
export class Menu extends React.Component {
    render() {
        return (
            <PluginSelector
                applications={this.props.args}
                compiler={this.props.compiler}
                hide={this.props.hide}
                load_new_model={this.props.load_new_model}
            ></PluginSelector>
        );
    }
}
