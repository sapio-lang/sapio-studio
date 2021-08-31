import * as React from 'react';
import { LinkWidget } from '@projectstorm/react-diagrams-core';
import { MouseEvent } from 'react';
import { SpendLinkModel } from './SpendLinkModel';
import { DefaultLinkWidget } from '@projectstorm/react-diagrams';
import { SpendLinkFactory } from './SpendLinkFactory';

export class SpendLinkWidget extends DefaultLinkWidget {
    generateLink(
        path: string,
        extraProps: any,
        id: string | number
    ): JSX.Element {
        const link: SpendLinkModel = this.props.link as SpendLinkModel;
        var Bottom = React.cloneElement(
            new SpendLinkFactory().generateLinkSegment(
                link,
                this.state.selected || this.props.link.isSelected(),
                path
            ),
            {
                ref: (ref: React.RefObject<SVGPathElement> | null) =>
                    ref && this.refPaths.push(ref),
            }
        );

        var _Top = React.cloneElement(Bottom, {
            ...extraProps,
            strokeLinecap: 'round',
            onMouseLeave: () => {
                this.setState({ selected: false });
            },
            onMouseEnter: () => {
                this.setState({ selected: true });
            },
            ref: null,
            'data-linkid': this.props.link.getID(),
            strokeOpacity: this.state.selected ? 0.1 : 0,
            strokeWidth: 20,
            onContextMenu: (event: Event) => {},
        });

        return <g key={'link-' + id}>{Bottom}</g>;
    }
    render() {
        //ensure id is present for all points on the path
        var points = this.props.link.getPoints();
        var paths = [];
        this.refPaths = [];

        if (points.length === 2) {
            paths.push(
                this.generateLink(
                    this.props.link.getSVGPath(),
                    {
                        onMouseDown: (event: MouseEvent) => {
                            this.addPointToLink(event, 1);
                        },
                    },
                    '0'
                )
            );

            // draw the link as dangeling
            if (this.props.link.getTargetPort() == null) {
                paths.push(this.generatePoint(points[1]!));
            }
        } else {
            //draw the multiple anchors and complex line instead
            for (let j = 0; j < points.length - 1; j++) {
                paths.push(
                    this.generateLink(
                        LinkWidget.generateLinePath(points[j]!, points[j + 1]!),
                        {
                            'data-linkid': this.props.link.getID(),
                            'data-point': j,
                            onMouseDown: (event: MouseEvent) => {
                                this.addPointToLink(event, j + 1);
                            },
                        },
                        j
                    )
                );
            }

            //render the circles
            for (let i = 1; i < points.length - 1; i++) {
                paths.push(this.generatePoint(points[i]!));
            }

            if (this.props.link.getTargetPort() == null) {
                paths.push(this.generatePoint(points[points.length - 1]!));
            }
        }

        return (
            <g data-default-link-test={this.props.link.getOptions().testName}>
                {paths}
            </g>
        );
    }
}
