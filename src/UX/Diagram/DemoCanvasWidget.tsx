import styled from '@emotion/styled';
import {
    DagreEngine,
    DiagramEngine,
    DiagramModel,
} from '@projectstorm/react-diagrams';
import * as React from 'react';

const Container = styled.div<{ color: string; background: string }>`
    height: 100%;
    background-color: ${(p) => p.background} !important;
    background-size: 50px 50px;
    display: flex;
    > * {
        height: 100%;
        min-height: 100%;
        width: 100%;
    }
    background-image: linear-gradient(
            0deg,
            transparent 24%,
            ${(p) => p.color} 25%,
            ${(p) => p.color} 26%,
            transparent 27%,
            transparent 74%,
            ${(p) => p.color} 75%,
            ${(p) => p.color} 76%,
            transparent 77%,
            transparent
        ),
        linear-gradient(
            90deg,
            transparent 24%,
            ${(p) => p.color} 25%,
            ${(p) => p.color} 26%,
            transparent 27%,
            transparent 74%,
            ${(p) => p.color} 75%,
            ${(p) => p.color} 76%,
            transparent 77%,
            transparent
        );
`;

export interface DemoCanvasWidgetProps {
    model: DiagramModel;
    engine: DiagramEngine;
    color?: string;
    background?: string;
    children: React.ReactNode;
}

export function DemoCanvasWidget(props: DemoCanvasWidgetProps) {
    const engine = new DagreEngine({
        graph: {
            rankdir: 'TB',
            align: 'DL',
            ranker: 'tight-tree',
            marginx: 25,
            marginy: 25,
        },
        includeLinks: false,
    });
    engine.redistribute(props.model);
    return (
        <Container
            background={props.background || 'rgb(60,60,60)'}
            color={props.color || 'rgba(255,255,255, 0.05)'}
        >
            {props.children}
        </Container>
    );
}
