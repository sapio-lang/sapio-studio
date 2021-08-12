import React from 'react';
import { PluginSelector } from './PluginSelector';
import { PluginAPI } from './PluginForm';

interface TileProps {
    parent: PluginSelector;
    app: Plugin;
}
export interface Plugin {
    api: PluginAPI;
    name: string;
    key: string;
    logo: string;
}
export class PluginTile extends React.Component<TileProps> {
    render() {
        const logo = "data:image/png;base64," + this.props.app.logo;
        return (
            <div className="PluginTile">
                <a
                    onClick={() => {
                        this.props.parent.select(this.props.app.key);
                    }}
                >
                    <div style={{ width: "100px", height: "100px" }}>
                        <img alt="logo" src={logo} width="100%" height="100%" />
                    </div>
                    <div>{this.props.app.name}</div>
                </a>
            </div>
        );
    }
}
