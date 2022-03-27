import React from 'react';
import { MuiForm5 as Form } from '@rjsf/material-ui';

import { ISubmitEvent } from '@rjsf/core';
import { logo_image, Plugin } from './PluginTile';
import { create_contract_of_type, switch_showing } from '../../../AppSlice';
import { useDispatch } from 'react-redux';
import { show_apis } from '../ContractCreatorSlice';
import './PluginForm.css';

interface PluginFormProps {
    app: Plugin;
}
export function PluginForm(props: PluginFormProps) {
    const dispatch = useDispatch();
    const handleSubmit = async (event: ISubmitEvent<any>, type: string) => {
        const formData = event.formData;
        dispatch(switch_showing('ContractViewer'));
        await dispatch(
            create_contract_of_type(type, null, JSON.stringify(formData))
        );
        dispatch(show_apis(false));
    };
    return (
        <div className="PluginForm">
            <div></div>
            <div>
                {logo_image(props.app)}
                <Form
                    schema={props.app.api}
                    onSubmit={(e: ISubmitEvent<any>) =>
                        handleSubmit(e, props.app.key)
                    }
                ></Form>
            </div>
            <div></div>
        </div>
    );
}
