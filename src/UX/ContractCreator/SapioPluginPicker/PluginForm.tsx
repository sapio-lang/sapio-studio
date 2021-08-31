import React from 'react';
import Form, { ISubmitEvent } from '@rjsf/core';
import { logo_image, Plugin } from './PluginTile';
import { create } from '../../Entity/EntitySlice';
import { create_contract_of_type } from '../../../AppSlice';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';

interface PluginFormProps {
    app: Plugin;
    hide: () => void;
    deselect: () => void;
}
export function PluginForm(props: PluginFormProps) {
    const dispatch = useDispatch();
    const handleSubmit = async (event: ISubmitEvent<any>, type: string) => {
        let formData = event.formData;
        await dispatch(create_contract_of_type(type, JSON.stringify(formData)));
        props.hide();
    };
    return (
        <div style={{ padding: '5%' }}>
            {logo_image(props.app)}
            <Form
                schema={props.app.api}
                onSubmit={(e: ISubmitEvent<any>) =>
                    handleSubmit(e, props.app.key)
                }
            ></Form>
        </div>
    );
}
