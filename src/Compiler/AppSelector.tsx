import React from 'react';
import Button from 'react-bootstrap/Button';
import Form, { ISubmitEvent } from '@rjsf/core';
import { CompilerServer } from './ContractCompilerServer';
import { emojis } from '../emojis';
import './AppSelector.css';
interface Application {
    title: string;
}
interface IProps {
    applications: Application[];
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
}
interface IState {
    selected: number | null;
}

interface TileProps {
    parent: AppSelector;
    title: string;
    index: number;
}
class AppTile extends React.Component<TileProps> {
    constructor(props: TileProps) {
        super(props);
    }
    render() {
        return (
            <div className="AppTile">
            <a
                onClick={() => {
                    this.props.parent.select(this);
                }}
            >
                <div>
                    <span style={{ width: '100px', fontSize: '100px' }}>
                        {emojis[this.props.index]}
                    </span>
                </div>
                <div>{this.props.title}</div>
            </a>
            </div>
        );
    }
}

interface ShowAppProps {
    app: Application;
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
    deselect: () => void;
}
class ShowApp extends React.Component<ShowAppProps> {
    render() {
        return (
            <div style={{ padding: '20px' }}>
                <Button
                    onClick={() => this.props.deselect()}
                    variant={'secondary'}
                >
                    Back
                </Button>
                <Form
                    schema={this.props.app}
                    onSubmit={(e: ISubmitEvent<any>) =>
                        this.handleSubmit(e, this.props.app.title)
                    }
                ></Form>
            </div>
        );
    }
    handleSubmit(event: ISubmitEvent<any>, type: string) {
        let formData = event.formData;
        const compiler = this.props.compiler;
        compiler.create(type, formData, this.props.load_new_model);
        this.props.hide();
    }
}
export class AppSelector extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            selected: null,
        };
    }
    deselect() {
        this.setState({ selected: null });
    }
    select(a: AppTile) {
        this.setState({ selected: a.props.index });
    }
    render() {
        let tiles = this.props.applications.map((app, i) => (
            <AppTile
                index={i}
                parent={this}
                title={app.title}
                key={app.title}
            />
        ));
        const total = 4 * 3;
        if (this.state.selected === null) {
            return (
                <div className="AppSelectorGrid">
                    <div className="back"></div>
                    <div className={"middle"}>{tiles}</div>
                    <div className="forward"></div>
                </div>
            );
        } else {
            return (
                <ShowApp
                    app={this.props.applications[this.state.selected]}
                    hide={this.props.hide}
                    compiler={this.props.compiler}
                    load_new_model={this.props.load_new_model}
                    deselect={this.deselect.bind(this)}
                />
            );
        }
    }
}
