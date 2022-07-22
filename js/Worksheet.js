/**
   * Worksheet web component
   * -----------------------
   * The worksheep component is a sort of flexible container
   * which conains a sheet (or potentially something else tbd)
   * has a useable border and displays information about the work
   * being done.
   **/

import { EndOfStackError, CallStack } from './callStack.js';
import icons from './utils/icons.js';
import createIconSVGFromString from './utils/helpers.js';
import BasicInterpreter from './interpreters.js';
import CSVParser from 'papaparse';

// Simple grid-based sheet component
const templateString = `
<style>
:host {
    position: absolute;
    padding: 3px;
    display: flex;
    align-items: stretch;
    flex-direction: column;
    border-radius: 5px;
    z-index: 1;
    overflow: hidden; /* to make resize work */
    resize: both;
    --bg-color: var(--palette-lightblue);
    --sheet-bg-color: var(--palette-cyan);
}

#header-bar {
    cursor: grab;
    width: 100%;
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    padding-left: 4px;
    padding-right: 4px;
    padding-top: 2px;
    padding-bottom: 2px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#header-bar > span {
    display: flex;
}

#header-bar > * > * {
    padding: 3px;
    background-color: transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.hide {
    display: none!important;
}

#header-bar > #title > input {
    display: none;
    border: inherit;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    text-align: inherit;
    background-color: transparent;
    color: inherit;
    padding-top: 3px;
    padding-bottom: 3px;
    padding-right: 5px;
    padding-left: 5px;
    outline: none !important;
}

#header-bar > #title > input.show {
    display: inline-flex;
    align-items: center;
}

#footer-bar {
    width: 100%;
    padding-left: 3px;
    padding-right: 4px;
    padding-top: 5px;
    padding-bottom: 2px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#footer-bar > span {
    display: flex;
}

#footer-bar > * > * {
    padding: 3px;
    background-color: transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

span[data-clickable="true"]{
    cursor: pointer;
}

svg {
    width: 20px;
    height: 20px;
    pointer-events: none;
}

input[type="file"]{
    display: none
}

my-grid {
    background-color: var(--palette-beige);
    z-index: 3;
    width: max-content; 
}

#sheet-container {
    flex: 1;
    overflow: hidden;
}


.overlay{
    position: absolute;
    height: 100%;
    width: 100%;
    display: flex;
    justify-content: center;
    align-content: center;
    align-items: center;
    flex-direction: column;
    opacity: 1;
    background-color: var(--palette-blue);
    opacity: .3;
}

.overlay > svg{
    width: 20%;
    height: 20%;
    stroke-width: 2;
}
.spreadsheet.editing-cell .view-cell:not(.editing) {
    opacity: 0.2;
    transition: opacity 0.2s linear;
}

.view-cell.editing {
    transform: scale(1.5);
    box-shadow: 0px 0px 5px 10px rgba(200, 200, 200, 0.4);
    transition: transform 0.2s linear; box-shadow 0.2s linear;
}

.in-locked-row {
    background-color: rgba(150, 150, 150, 0.4);
}
.in-locked-column {
    background-color: rgba(150, 150, 150, 0.4);
}
.view-cell {
    background-color: transparent;
    color: var(--palette-black);
    border-right: 2px solid rgba(200, 200, 200, 0.5);
    border-bottom: 2px solid rgba(200, 200, 200, 0.5);
    border-top: 2px solid transparent;
    border-left: 2px solid transparent;
}

.view-cell:last-child {
    border: 2px solid transparent;
}

#button-area {
    margin-top: 30px;
}

.sheet-move-button {
    display: block;
    font-size: 3rem;
}

.selector-cursor {
    border: 2px solid red;
}

.selector-anchor {
    border: 2px solid orange;
}

.in-selection {
    background-color: rgba(255, 50, 50, 0.1);
}
.selection-top-border {
    border-top: 2px solid red;
}
.selection-bottom-border {
    border-bottom: 2px solid red;
}
.selection-left-border {
    border-left: 2px solid red;
}
.selection-right-border {
    border-right: 2px solid red;
}

</style>
<div id="header-bar">
    <span id="header-left">
    </span>
    <span data-clickable=true id="title">
        <span>A worksheet</span>
        <input></input>
    </span>
    <span id="header-right">
    </span>
</div>
<div id="sheet-container">
    <my-grid id="ap-sheet" expands="both" columns=5 rows=10></my-grid>
</div>
<div id="footer-bar">
    <span id="footer-left">
    </span>
    <span id="footer-middle">
    </span>
    <span id="footer-right">
    </span>
</div>
<div class="overlay hide">
    ${icons.link}
</div>

`;


class Worksheet extends HTMLElement {
    constructor(){
        super();
        this.template = document.createElement('template');
        this.template.innerHTML = templateString;
        this.attachShadow({mode: 'open', delegatesFocus: true});
        this.shadowRoot.appendChild(
            this.template.content.cloneNode(true)
        );

        // a randomly generated UUID
        this.id;

        // the current callStack and available commandis
        this.callStack;

        // generate a random palette for the worksheet

        // name for the worksheet. Note: this is the name found in the header area
        // and also in the this.name attribute for querying and listening for changes
        this.name = "";
        this.isEditingName = false;

        // bind methods
        this.addToFooter = this.addToFooter.bind(this);
        this.addToHeader = this.addToHeader.bind(this);
        this.addSource = this.addSource.bind(this);
        this.removeSource = this.removeSource.bind(this);
        this.addTarget = this.addTarget.bind(this);
        this.removeTarget = this.removeTarget.bind(this);
        this.removeLink = this.removeLink.bind(this);
        this.onMouseMoveInHeader = this.onMouseMoveInHeader.bind(this);
        this.onMouseDownInHeader = this.onMouseDownInHeader.bind(this);
        this.onMouseUpAfterDrag = this.onMouseUpAfterDrag.bind(this);
        this.onNameDblClick = this.onNameDblClick.bind(this);
        this.onNameKeydown = this.onNameKeydown.bind(this);
        this.updateName = this.updateName.bind(this);
        this.onErase = this.onErase.bind(this);
        this.onUpload = this.onUpload.bind(this);
        this.onDownload = this.onDownload.bind(this);
        this.onDelete = this.onDelete.bind(this);
        this.onRun = this.onRun.bind(this);
        this.onStep = this.onStep.bind(this);
        this.onExternalLinkDragStart = this.onExternalLinkDragStart.bind(this);
        this.onDragOver = this.onDragOver.bind(this);
        this.onDragLeave = this.onDragLeave.bind(this);
        this.onDrop = this.onDrop.bind(this);
        this.onCallStackStep = this.onCallStackStep.bind(this);

        // Bound serialization methods
        this.toCSV = this.toCSV.bind(this);
        this.fromCSV = this.fromCSV.bind(this);
    }

    connectedCallback(){
        // set the id; NOTE: at the moment this is a random UUID
        this.setAttribute("id",  window.crypto.randomUUID());
        const interpreter = new BasicInterpreter();
        this.callStack = new CallStack(interpreter);
        this.callStack.onStep = this.onCallStackStep;

        // set the sources and targets to ""
        this.setAttribute("sources", "");
        this.setAttribute("targets", "");


        this.addToHeader(this.trashButton(), "left");
        this.addToHeader(this.uploadButton(), "left");
        this.addToHeader(this.downloadButton(), "left");
        this.addToHeader(this.eraseButton(), "right");
        this.addToHeader(this.stepButton(), "right");
        this.addToHeader(this.runButton(), "right");
        this.addToFooter(this.linkButton(), "right");
        const header = this.shadowRoot.querySelector('#header-bar');
        const name = header.querySelector('#title');

        // set icon titles for hover over

        // set the name to default
        this.updateName("The worksheet");

        // add event listeners
        header.addEventListener("mousedown", this.onMouseDownInHeader);
        name.addEventListener("dblclick", this.onNameDblClick);
        this.addEventListener("dragover", this.onDragOver);
        this.addEventListener("dragleave", this.onDragLeave);
        this.addEventListener("drop", this.onDrop);

        // Stash a reference to the underlying ap-sheet
        this.sheet = this.shadowRoot.getElementById('ap-sheet');

        // set the palette
        this.style.backgroundColor = "var(--bg-color)";
        this.sheet.style.backgroundColor = "var(--sheet-bg-color)";
    }

    disconnectedCallback(){
        // remove event listeners
        const header = this.shadowRoot.querySelector('#header-bar');
        const name = header.querySelector('span');
        header.addEventListener("mousedown", this.onMouseDownInHeader);
        name.addEventListener("dblclick", this.onNameDblClick);
        this.removeEventListener("dragover", this.onDragOver);
        this.addEventListener("dragleave", this.onDragLeave);
        this.removeEventListener("drop", this.onDrop);
    }


    /* I add an element to the header.
       element: DOM element
       location: str (one of "left", "right")
    */
    addToHeader(element, location, prepend=false){
        const header = this.shadowRoot.querySelector('#header-bar');
        const parent = header.querySelector(`#header-${location}`);
        if(prepend){
            parent.prepend(element);
        } else {
            parent.append(element);
        }
    }

    /* I add an element to the footer.
       element: DOM element
       location: str (one of "left", "right", "middle")
       */
    addToFooter(element, location, prepend=false){
        const footer = this.shadowRoot.querySelector('#footer-bar');
        const parent = footer.querySelector(`#footer-${location}`);
        if(prepend){
            parent.prepend(element);
        } else {
            parent.append(element);
        }
    }

    /* default header/footer buttons */
    trashButton(){
        const svg = createIconSVGFromString(icons.trash);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.addEventListener("click", this.onDelete);
        button.setAttribute("title", "delete this sheet");
        button.setAttribute("data-clickable", true);
        return button;
    }

    uploadButton(){
        const label = document.createElement("label");
        label.setAttribute("id", "upload");
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("accept", ".csv,.xlsx,.xls");
        input.setAttribute("title", "upload a sheet");
        const svg = createIconSVGFromString(icons.fileUpload);
        label.appendChild(input);
        label.appendChild(svg);
        label.addEventListener("change", this.onUpload);
        return label;
    }

    downloadButton(){
        const svg = createIconSVGFromString(icons.fileDownload);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.addEventListener("click", this.onDownload);
        button.setAttribute("title", "Download locally as CSV");
        button.setAttribute("data-clickable", true);
        return button;
    }

    eraseButton(){
        const svg = createIconSVGFromString(icons.eraser);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.addEventListener("click", this.onErase);
        button.setAttribute("title", "clear values");
        button.setAttribute("data-clickable", true);
        return button;
    }

    runButton(){
        const svg = createIconSVGFromString(icons.run);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.addEventListener("click", this.onRun);
        button.setAttribute("title", "run commands");
        button.setAttribute("data-clickable", true);
        return button;
    }

    stepButton(){
        const svg = createIconSVGFromString(icons.walk);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.addEventListener("click", this.onStep);
        button.setAttribute("title", "step to next command");
        button.setAttribute("data-clickable", true);
        return button;
    }

    linkButton(){
        const svg = createIconSVGFromString(icons.link);
        const button = document.createElement("span");
        button.appendChild(svg);
        button.setAttribute("title", "drag and drop onto a sheet to link");
        button.setAttribute("id", "e-link");
        button.setAttribute("data-clickable", true);
        button.setAttribute("draggable", true);
        button.addEventListener("dragstart", this.onExternalLinkDragStart);
        return button;
    }

    onMouseDownInHeader(){
        // dispatch an event to put the sheet in focus
        const event = new CustomEvent(
            'newSheetFocus',
            {
                bubbles: true,
                detail: {target: this}
            }
        );
        this.dispatchEvent(event);
        document.addEventListener('mousemove', this.onMouseMoveInHeader);
        document.addEventListener('mouseup', this.onMouseUpAfterDrag);
    }

    onMouseUpAfterDrag(){
        document.removeEventListener('mouseup', this.onMouseUpAfterDrag);
        document.removeEventListener('mousemove', this.onMouseMoveInHeader);
    }

    onMouseMoveInHeader(event){
        const currentLeft = this.getBoundingClientRect().left;
        const currentTop = this.getBoundingClientRect().top;
        const newTop = currentTop + event.movementY;
        const newLeft = currentLeft + event.movementX;
        this.style.setProperty("top", newTop + 'px');
        this.style.setProperty("left", newLeft + 'px');

        // Trigger a custom move event so that
        // implementors of the Worksheet can react
        let moveEvent = new CustomEvent('worksheet-moved', {
            bubbles: true,
            detail: {
                movementX: event.movementX,
                movementY: event.movementY
            }
        });
        this.dispatchEvent(moveEvent);
    }

    onNameDblClick(){
        if(!this.isEditingName){
            this.startEditingName();
        }
    }

    onNameKeydown(event){
        if(event.key == "Enter"){
            event.preventDefault();
            event.stopPropagation();
            this.stopEditingName();
        }
    }

    updateName(name){
        const header = this.shadowRoot.querySelector('#header-bar');
        const nameSpan = header.querySelector('#title > span');

        this.name = name;
        this.setAttribute("name", name);
        nameSpan.textContent = this.name;
    }

    startEditingName(){
        this.isEditingName = true;
        const header = this.shadowRoot.querySelector('#header-bar');
        const nameSpan = header.querySelector('#title > span');
        nameSpan.classList.add("hide");
        const input = header.querySelector('#title > input');
        input.classList.add('show');
        input.value = this.name;
        input.addEventListener('keydown', this.onNameKeydown);
        // input.addEventListener('blur', this.handleInputBlur);
        input.focus();
    }

    stopEditingName(){
        this.isEditingName = false;
        const header = this.shadowRoot.querySelector('#header-bar');
        const input = header.querySelector('#title > input');
        const nameSpan = header.querySelector('#title > span');
        nameSpan.classList.remove("hide");
        input.removeEventListener('keydown', this.onNameKeydown);
        input.classList.remove('show');
        let newName = input.value;
        if(!newName){
            newName = "A worksheet";
        }
        this.updateName(newName);
        //input.removeEventListener('blur', this.handleInputBlur);
        // input.blur();
    }

    onDelete(){
        const msg = `Are you sure you want to delete ${this.name}?`;
        if(window.confirm(msg)){
            this.remove();
        }
    }

    onErase(){
        this.sheet.dataFrame.clear();
    }

    onUpload(event){
        let file = event.target.files[0];
        let reader = new FileReader();
        reader.addEventListener('load', loadEv => {
            this.fromCSV(loadEv.target.result);
        });
        reader.addEventListener("error", (e) => {
            console.error(e);
            alert("An error occurred reading this file");
            return;
        });

        // Will trigger the reader.load event
        reader.readAsText(file);
        // set the name of the sheet to the file name; TODO: do we want this?
        this.updateName(file.name);
    }

    onDownload(event){
        let csv = this.toCSV();
        let anchor = document.createElement('a');
        anchor.style.display = "none";
        let blob = new Blob([csv], {type: 'text/csv'});
        let url = window.URL.createObjectURL(blob);
        anchor.href = url;
        anchor.download = `${this.name}.csv`;
        document.body.append(anchor);
        anchor.click();
        window.URL.revokeObjectURL(url);
    }

    // TODO this should really be handled by sheet
    _getInstructions(){
        const source = this.getAttribute("sources").split(",")[0];
        const target = this.getAttribute("targets").split(",")[0];
        const nonEmptyCoords = Object.keys(this.sheet.dataFrame.store).filter((k) => {
            return this.sheet.dataFrame.getAt(k.split(','))
        });
        const nonEmptyCols = [];
        const nonEmptyRows = [];
        nonEmptyCoords.forEach((coord) => {
            const [c, r] = coord.split(',');
            nonEmptyCols.push(parseInt(c));
            nonEmptyRows.push(parseInt(r));
        });
        const maxCol = nonEmptyCols.sort()[nonEmptyCols.length - 1];
        const maxRow = nonEmptyRows.sort()[nonEmptyRows.length - 1];

        const instructions = [];
        let c = 0;
        let r = 0;

        while(r <= maxRow){
            const row = [];
            while(c <= maxCol){
                let entry = this.sheet.dataFrame.getAt([c, r]);
                if(parseInt(c) == 0){
                    entry = `${source}!${entry}`;
                } else if(parseInt(c) == 1){
                    entry = `${target}!${entry}`;
                }
                row.push(entry);
                c += 1;
            }
            instructions.push(row);
            r += 1;
            c = 0;
        }
        return instructions;
    }

    onRun(){
        if(!this.getAttribute("sources") || !this.getAttribute("targets")){
            alert("You must have both sources and targets set to run!");
            return;
        }
        // TODO we want to allow multiple sources and targets
        this.callStack.load(this._getInstructions());
        this.callStack.run();
        /*
        this.callStack.runAll(
            this.getAttribute("sources").split(","),
            this.getAttribute("targets").split(",")
        );
        */
    }

    onStep(){
        if(!this.getAttribute("sources") || !this.getAttribute("targets")){
            alert("You must have both sources and targets set to run!");
            return;
        }
        // TODO we want to allow multiple sources and targets
        this.callStack.load(this._getInstructions(), false); // do not reset the counter
        try{
            this.callStack.step();
            this.callStack.execute();
        } catch (EndOfStackError){
            console.log(EndOfStackError);
            this.callStack.reset();
        }
        /*
        this.callStack.runAll(
            this.getAttribute("sources").split(","),
            this.getAttribute("targets").split(",")
        );
        */
    }

    onCallStackStep(){
        if(this.callStack.COUNTER > -1){
            // make sure no other tabs are highlighted atm
            const tabs = this.sheet.shadowRoot.querySelectorAll("row-tab");
            tabs.forEach((tab) => {
                tab.removeAttribute("highlighted");
            });
            // grab the corresponding row tab
            const tab = this.sheet.shadowRoot.querySelector(`row-tab[data-relative-y='${this.callStack.COUNTER}']`);
            // if the tab is not found then it is out of the view and we need to shift accordingly
            /* TODO this is a big buggy and not clear we want it
            if(!tab){
                const shift = this.callStack.COUNTER - tabs.length + 1;
                this.sheet.primaryFrame.shiftDownBy(shift);
                tab = this.sheet.shadowRoot.querySelector(`row-tab[data-relative-y='${this.callStack.COUNTER}']`);
            }
            */
            tab.setAttribute("highlighted", true);
        }
    }

    onExternalLinkDragStart(event){
        event.dataTransfer.setData("id", this.id);
        event.dataTransfer.setData("name", this.name);
        event.dataTransfer.setData("worksheet-link", true);
        event.dataTransfer.effectAllowed = "all";
    }

    onDragOver(event){
        event.stopPropagation();
        event.preventDefault();
        const overlay = this.shadowRoot.querySelector(".overlay");
        // NOTE: dataTransfer payload can disappear in the debugger - fun!
        // Also detecting whether a drop event is file drop is not consistent across browsers
        // and is touchy in general
        if(event.dataTransfer.types.indexOf("Files") != -1 || event.dataTransfer.getData("worksheet-link")){
            overlay.classList.remove("hide");
            event.dataTransfer.dropEffect = "link";
            let iconString = icons.link;
            if(event.dataTransfer.types.indexOf("Files") != -1 ){
                event.dataTransfer.dropEffect = "copy";
                iconString = icons.fileUpload;
            }
            const template = document.createElement("template");
            template.innerHTML = iconString;
            const iconSVG = template.content.childNodes[0];
            overlay.replaceChildren(iconSVG);
        }
    }

    onDragLeave(event){
        event.stopPropagation();
        event.preventDefault();
        const overlay = this.shadowRoot.querySelector(".overlay");
        overlay.classList.add("hide");
    }

    onDrop(event){
        event.stopPropagation();
        event.preventDefault();
        const overlay = this.shadowRoot.querySelector(".overlay");
        overlay.classList.add("hide");
        if(event.dataTransfer.getData("worksheet-link")){
            // add the source
            const sourceId = event.dataTransfer.getData("id");
            const sourceName = event.dataTransfer.getData("name");
            this.addSource(sourceId, sourceName);
            // now tell the source to add me as a target
            // TODO: maybe all of this source/target adding/removing should
            // handled with custom events...?
            const sourceSheet = document.getElementById(sourceId);
            sourceSheet.addTarget(this.id, this.name);
        } else if(event.dataTransfer.files){
            // set the event.target.files to the dataTransfer.files
            // since that is what this.onUpload() expects
            event.target.files = event.dataTransfer.files;
            this.onUpload(event);
        }
    }

    addSource(id, name){
        const sources = this._attributeToList("sources");
        if(sources.indexOf(id) != -1){
            alert(`${id} already added`);
            return;
        }
        sources.push(id);
        this.setAttribute("sources", sources);
        // add an icon with data about the source to the footer
        const sourceSpan = this._createSourceTargetIconSpan("source", id, name);
        this.addToFooter(sourceSpan, "left");
        return id;
    }

    removeSource(id){
        let sources = this._attributeToList("sources");
        sources = sources.filter((item) => {return item != id});
        this.setAttribute("sources", sources);
        // remove the source link
        const footer = this.shadowRoot.querySelector("#footer-bar");
        const linkContainer = footer.querySelector('#footer-left');
        linkContainer.querySelectorAll(`[data-id='${id}']`).forEach((item) => {item.remove();});
    }

    addTarget(id, name){
        const targets = this._attributeToList("targets");
        if(targets.indexOf(id) != -1){
            alert(`${id} already added`);
            return;
        }
        targets.push(id);
        this.setAttribute("targets", targets);
        // add an icon with data about the target to the footer
        const targetSpan = this._createSourceTargetIconSpan("target", id, name);
        this.addToFooter(targetSpan, "right", true);
        return id;
    }

    removeTarget(id){
        let targets = this._attributeToList("targets");
        targets = targets.filter((item) => {return item != id});
        this.setAttribute("targets", targets);
        // remove the target link
        const footer = this.shadowRoot.querySelector("#footer-bar");
        const linkContainer = footer.querySelector('#footer-right');
        linkContainer.querySelectorAll(`[data-id='${id}']`).forEach((item) => {item.remove();});
    }

    removeLink(event){
        event.stopPropagation();
        event.preventDefault();
        console.log(event.target);
        // remove the link and
        // tell the corresponding target worksheets to remove the link
        // TODO: maybe this should all be handled with custom events
        const id = event.target.getAttribute("data-id");
        const worksheet = document.getElementById(id);
        // NOTE: it's possible that the worksheet is null (for example it was
        // deleted earlier). In this case we should ignore, although TODO this should
        // all be better handled in a uniform model
        if(event.target.getAttribute("data-type") == "source"){
            this.removeSource(id);
            if(worksheet){
                worksheet.removeTarget(this.id);
            }
        } else {
            this.removeTarget(id);
            if(worksheet){
                worksheet.removeSource(this.id);
            }
        }
    }

    /**
      * Convert a DOM element attribute to a list
      */
    _attributeToList(name){
        let attr = this.getAttribute(name);
        if(!attr){
            attr = [];
        } else {
            attr = attr.split(",");
        }
        return attr;
    }

    /**
      * Create a DOM element from an SVG string
      * for both the source/target icon as well as the
      * unlink icon. Adds event listeners for mousenter and
      * mouseleave.
      */
    _createSourceTargetIconSpan(type, id, name){
        // make a reference to the source/target sheet
        // to update css on hover
        const sheet = document.getElementById(id);
        let iconString;
        if(type == "source"){
            iconString = icons.sheetImport;
        } else {
            iconString = icons.sheetExport;
        }
        const icon = createIconSVGFromString(iconString);
        const iconSpan = document.createElement("span");
        iconSpan.appendChild(icon);
        iconSpan.setAttribute("data-type", type);
        iconSpan.setAttribute("data-id", id);
        iconSpan.setAttribute("title", `${type}: ${name} (${id})`);
        // overlay the unlink icon
        const unlinkIcon = createIconSVGFromString(icons.unlink);
        unlinkIcon.setAttribute("data-type", type);
        unlinkIcon.setAttribute("data-id", id);
        unlinkIcon.style.display = 'none';
        iconSpan.addEventListener("click", this.removeLink);
        iconSpan.appendChild(unlinkIcon);
        iconSpan.addEventListener("mouseover", () => {
            unlinkIcon.style.display = "inherit";
            icon.style.display = "none";
            sheet.style.outline = "solid var(--palette-blue)";
        });
        iconSpan.addEventListener("mouseleave", () => {
            unlinkIcon.style.display = "none";
            icon.style.display = "inherit";
            sheet.style.outline = "initial";
        });
        return iconSpan;
    }

    fromCSV(aString){
        let data = CSVParser.parse(aString).data;
        if(data){
            this.sheet.dataFrame.clear();
            this.sheet.dataFrame.corner.x = data[0].length - 1;
            this.sheet.dataFrame.corner.y = data.length - 1;
            this.sheet.dataFrame.loadFromArray(data);
            this.sheet.render();
        }
    }

    toCSV(){
        let data = this.sheet.dataFrame.getDataArrayForFrame(
            this.sheet.dataFrame
        );
        return CSVParser.unparse(data);
    }
}

window.customElements.define("work-sheet", Worksheet);

export {
    Worksheet,
    Worksheet as default
};
