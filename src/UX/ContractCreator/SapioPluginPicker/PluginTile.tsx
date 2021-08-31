import React from 'react';
import { PluginSelector } from './PluginSelector';
import { JSONSchema7 } from 'json-schema';

interface TileProps {
    select: (key: string) => void;
    app: Plugin;
}
export interface Plugin {
    api: JSONSchema7;
    name: string;
    key: string;
    logo: string;
}
export function logo_image(app: Plugin) {
    const logo = 'data:image/png;base64,' + app.logo;
    return (
        <div
            style={{
                width: '100%',
                height: 'auto',
                justifyContent: 'center',
                position: 'relative',
                display: 'flex',
            }}
        >
            <img alt="logo" src={logo} width="100px" height="100px" />
        </div>
    );
}
export class PluginTile extends React.Component<TileProps> {
    render() {
        return (
            <div className="PluginTile">
                <a
                    onClick={() => {
                        this.props.select(this.props.app.key);
                    }}
                >
                    {logo_image(this.props.app)}
                    <div>{this.props.app.name}</div>
                </a>
            </div>
        );
    }
}
