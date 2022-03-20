import React from 'react';
import './PluginSelector.css';
import { PluginTile } from './PluginTile';
import { PluginForm } from './PluginForm';
import { selectAPIs, selectSelectedAPI } from '../ContractCreatorSlice';
import { useDispatch, useSelector } from 'react-redux';
export function PluginSelector() {
    const dispatch = useDispatch();
    const apis = useSelector(selectAPIs);
    const selected = useSelector(selectSelectedAPI);

    if (apis === null) return null;
    if (selected !== null) {
        return (
            <div>
                <PluginForm app={apis[selected]!} />
            </div>
        );
    } else {
        const tiles = Array.from(Object.entries(apis), ([name, app], i) => (
            <PluginTile app={app} />
        ));
        return (
            <div className="PluginSelectorGrid">
                <div className="back"></div>
                <div className={'middle'}>{tiles}</div>
                <div className="forward"></div>
            </div>
        );
    }
}
