import React, {Component} from "react";

const ImageScroller = require("./image-scroller.jsx")
const OutputImages = require("../../shared/images.js").OutputImages;
const TooltipEngine = require("../../ui/tooltip-engine.js");
const TooltipPositioner = require("./tooltip-positioner.js");
const TooltipUtils = require("./tooltip-utils.js");

// A description of general tooltip flow can be found in tooltip-engine.js
class ImagePicker extends Component {

    props: {
        // Common to all tooltips
        autofillEnabled: boolean,
        isEnabled: boolean,
        eventToCheck: Object,
        aceEditor: Object,
        editorScrollTop: number,
        editorType: string,
        onEventCheck: Function,
        onTextInsertRequest: Function,
        onTextUpdateRequest: Function,
        // Specific to ImagePicker
        imagesDir: string,
    };

    constructor(props) {
        super(props);
        this.state = {
            closing: "",
            imageName: "cute/None",
        };
        this.regex = RegExp(/(\bgetImage\s*\()[^)]*$/);
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.eventToCheck) {
            this.checkEvent(this.props.eventToCheck);
        }
    }

    checkEvent(event) {
        if (!this.regex.test(event.pre)) {
            return this.props.onEventCheck(false);
        }
        const functionStart = event.col - RegExp.lastMatch.length;
        const paramsStart = functionStart + RegExp.$1.length;
        const pieces = /^(\s*)(["']?[^)]*?["']?)\s*(\);?|$)/.exec(event.line.slice(paramsStart));
        const leadingPadding = pieces[1];
        const pathStart = paramsStart + leadingPadding.length;
        let path = pieces[2];
        let closing = pieces[3];

        // TODO: De-dupe this with similar code in other tooltips
        if (leadingPadding.length === 0 &&
            path.length === 0 &&
            closing.length === 0 &&
            event.source && event.source.action === "insert" &&
            event.source.lines[0].length === 1 && this.props.autofillEnabled) {

            closing = ")" + (TooltipUtils.isAfterAssignment(event.pre.slice(0, functionStart)) ? ";" : "");
            this.props.onTextInsertRequest({
                row: event.row,
                column: pathStart
            }, closing);

            path = this.state.imageName;
            this.props.onTextUpdateRequest(`"${path}"`);
        }
        const aceLocation = {
            start: pathStart,
            length: path.length,
            row: event.row
        };
        const cursorCol = aceLocation.start + aceLocation.length + closing.length;

        this.updateTooltip(path);
        this.setState({ closing, cursorCol, cursorRow: aceLocation.row});
        this.props.onEventCheck(true, aceLocation);
    }

    updateTooltip(rawPath) {
        let foundPath = this.state.imageName;

        const path = /^["']?(.*?)["']?$/.exec(rawPath)[1];
        const pathParts = path.split("/");
        const groupName = pathParts[0];
        const fileName = pathParts[1];
        OutputImages.forEach((group) => {
            if (group.groupName === groupName) {
                group.images.forEach((imageName) => {
                    if (imageName === fileName) {
                        foundPath = groupName + "/" + fileName;
                    }
                });
            }
        });
        this.setState({imageName: foundPath});
    }

    renderImageScroller() {
        const props = {
            imageName: this.state.imageName,
            imagesDir: this.props.imagesDir,
            imageGroups: OutputImages,
            onMouseLeave: () => {
                // TODO: Propagate to parent of parent?
                this.props.aceEditor.clearSelection();
                this.props.aceEditor.focus();
            },
            onImageSelect: (imageName) => {
                this.updateTooltip(`"${imageName}"`);
                this.props.onTextUpdateRequest(`"${imageName}"`);
            }
        };
        return <ImageScroller {...props} />;
    }

    render() {
        if (!this.props.isEnabled) {
            return null;
        }
        return <TooltipPositioner
                    aceEditor={this.props.aceEditor}
                    editorScrollTop={this.props.editorScrollTop}
                    children={this.renderImageScroller()}
                    cursorRow={this.state.cursorRow}
                    cursorCol={this.state.cursorCol}
                    startsOpaque={true}
                    toSide="right"
                />;
    }
}

TooltipEngine.registerTooltip("imagePicker", ImagePicker);

module.exports = ImagePicker;