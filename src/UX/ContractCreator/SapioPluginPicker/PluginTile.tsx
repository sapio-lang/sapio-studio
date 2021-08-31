import React from 'react';
import { PluginSelector } from './PluginSelector';
import { JSONSchema7 } from 'json-schema';
import { useDispatch } from 'react-redux';
import { select_api } from '../ContractCreatorSlice';

interface TileProps {
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
export function PluginTile(props: TileProps) {
    const dispatch = useDispatch();
    return (
        <div className="PluginTile">
            <a
                onClick={() => {
                    dispatch(select_api(props.app.key));
                }}
            >
                {logo_image(props.app)}
                <div>{props.app.name}</div>
            </a>
        </div>
    );
}
