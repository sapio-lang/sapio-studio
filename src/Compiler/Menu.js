import React from 'react';
import { AppSelector } from './AppSelector';
export class Menu extends React.Component {
    render() {
        return (
            <AppSelector
                applications={this.props.args['oneOf']}
                compiler={this.props.compiler}
                hide={this.props.hide}
                load_new_model={this.props.load_new_model}
            ></AppSelector>
        );
    }
}
