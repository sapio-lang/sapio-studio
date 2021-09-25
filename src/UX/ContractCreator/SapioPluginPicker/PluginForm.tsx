import React from 'react';
import Form from '@rjsf/material-ui';
import { ISubmitEvent } from '@rjsf/core';
import { logo_image, Plugin } from './PluginTile';
import { create_contract_of_type } from '../../../AppSlice';
import { useDispatch } from 'react-redux';
import { showAPIs, show_apis } from '../ContractCreatorSlice';

interface PluginFormProps {
    app: Plugin;
}
export function PluginForm(props: PluginFormProps) {
    const dispatch = useDispatch();
    const handleSubmit = async (event: ISubmitEvent<any>, type: string) => {
        let formData = event.formData;
        await dispatch(create_contract_of_type(type, JSON.stringify(formData)));
        dispatch(show_apis(false));
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
