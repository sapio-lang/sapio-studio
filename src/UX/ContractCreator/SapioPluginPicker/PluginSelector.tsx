import React from 'react';
import './PluginSelector.css';
import { PluginTile } from './PluginTile';
import { PluginForm } from './PluginForm';
import { selectAPI, selectAPIEntries } from '../ContractCreatorSlice';
import { useDispatch, useSelector } from 'react-redux';
export function PluginSelector() {
    const dispatch = useDispatch();
    const selected = useSelector(selectAPI);
    const all_apis = useSelector(selectAPIEntries);

    if (selected !== null) {
        return (
            <div>
                <PluginForm app={selected} />
            </div>
        );
    } else {
        const tiles = Array.from(all_apis, ([name, app], i) => (
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
