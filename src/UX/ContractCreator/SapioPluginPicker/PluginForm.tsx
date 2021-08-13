import React from 'react';
import Form, { ISubmitEvent } from '@rjsf/core';
import { CompilerServer } from '../../../Compiler/ContractCompilerServer';
import { Plugin } from './PluginTile';

interface PluginFormProps {
    app: Plugin;
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
    deselect: () => void;
}
export class PluginForm extends React.Component<PluginFormProps> {
    render() {
        return (
            <div style={{ padding: '5%' }}>
                <Form
                    schema={this.props.app.api}
                    onSubmit={(e: ISubmitEvent<any>) => this.handleSubmit(e, this.props.app.key)}
                ></Form>
            </div>
        );
    }
    async handleSubmit(event: ISubmitEvent<any>, type: string) {
        let formData = event.formData;
        const compiler = this.props.compiler;
        await compiler.create(type, JSON.stringify(formData));
        this.props.hide();
    }
}
