import React from 'react';
import Button from 'react-bootstrap/Button';
import './PluginSelector.css';
import { Plugin, PluginTile } from './PluginTile';
import { PluginForm } from './PluginForm';
import { APIs, selectAPIs } from '../ContractCreatorSlice';
import { useSelector } from 'react-redux';
export function PluginSelector() {
    const apis = useSelector(selectAPIs);
    const [selected, setSelected] = React.useState<string | null>(null);

    if (apis === null) return null;
    let tiles = Array.from(Object.entries(apis), ([name, app], i) => (
        <PluginTile app={app} select={(s: string) => setSelected(s)} />
    ));
    if (selected !== null) {
        return (
            <div>
                <div style={{ textAlign: 'right', paddingRight: '20px' }}>
                    <a onClick={() => setSelected(null)}>
                        <span className="glyphicon glyphicon-arrow-left"></span>
                    </a>
                </div>
                <PluginForm app={apis[selected]!} />
            </div>
        );
    } else {
        return (
            <div className="PluginSelectorGrid">
                <div className="back"></div>
                <div className={'middle'}>{tiles}</div>
                <div className="forward"></div>
            </div>
        );
    }
}
