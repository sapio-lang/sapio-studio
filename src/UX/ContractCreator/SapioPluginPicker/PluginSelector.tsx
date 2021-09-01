import React from 'react';
import Button from 'react-bootstrap/Button';
import './PluginSelector.css';
import { Plugin, PluginTile } from './PluginTile';
import { PluginForm } from './PluginForm';
import {
    APIs,
    selectAPIs,
    selectSelectedAPI,
    select_api,
} from '../ContractCreatorSlice';
import { useDispatch, useSelector } from 'react-redux';
export function PluginSelector() {
    const dispatch = useDispatch();
    const apis = useSelector(selectAPIs);
    const selected = useSelector(selectSelectedAPI);

    if (apis === null) return null;
    if (selected !== null) {
        return (
            <div>
                <div style={{ textAlign: 'right', paddingRight: '20px' }}>
                    <a onClick={() => dispatch(select_api(null))}>
                        <span className="glyphicon glyphicon-arrow-left"></span>
                    </a>
                </div>
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
