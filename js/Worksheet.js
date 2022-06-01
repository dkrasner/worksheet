/**
   * Worksheet web component
   * -----------------------
   * The worksheep component is a sort of flexible container
   * which conains a sheet (or potentially something else tbd)
   * has a useable border and displays information about the work
   * being done.
   **/

import CallStack from './callStack.js';
import commandRegistry from './commandRegistry.js';
import icons from './utils/icons.js';

// Simple grid-based sheet component
const templateString = `
<style>
* { box-sizing: border-box; }
:host {
    position: absolute;
    padding: 3px;
    background-color: var(--palette-orange);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    border-radius: 5px;
    z-index: 1;
    overflow: hidden; /* to make resize work */
    resize: both;
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

#header-bar > #title > span {
    padding: 3px;
    background-color: transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#header-bar > #title > span.hide {
    display: none;
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
    border-top: 1px solid black;
}

span[data-clickable="true"]{
    cursor: pointer;
}

svg {
    width: 20px;
    height: 20px;
    pointer-events: none;
}

my-grid {
    background-color: var(--palette-beige);
    z-index: 3;
}

#sheet-container{
    flex: 1;
    overflow: auto;
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
    <span data-clickable=true id="trash">
        ${icons.trash}
    </span>
    <span data-clickable=true id="title">
        <span>A worksheet</span>
        <input></input>
    </span>
    <span>
        <span data-clickable=true id="run">
            ${icons.run}
        </span>
        <span data-clickable=true id="erase">
            ${icons.eraser}
        </span>
    </span>
</div>
<div id="sheet-container">
    <my-grid expands="both" columns=5 rows=10></my-grid>
</div>
<div id="footer-bar">
    <span id="sources">
    </span>
    <span id="targets">
        <span data-clickable=true id="e-link">
            ${icons.link}
        </span>
    </span>
</div>

`;

// a few palette combo options for the sheet + bar area
const paletteCombinations = [
    {this: 'var(--palette-orange)', sheet: 'var(--palette-beige)'},
    {this: 'var(--palette-lightblue)', sheet: 'var(--palette-cyan)'},
    {this: 'var(--palette-cyan)', sheet: 'var(--palette-lightblue)'},
]

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
        this.commandRegistry = commandRegistry;

        // generate a random palette for the worksheet
        this.palette = paletteCombinations[Math.floor(Math.random() * paletteCombinations.length)];

        // name for the worksheet. Note: this is the name found in the header area
        // and also in the this.name attribute for querying and listening for changes
        this.name = "";
        this.isEditingName = false;

        // bind methods
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
        this.onDelete = this.onDelete.bind(this);
        this.onRun = this.onRun.bind(this);
        this.onExternalLinkDragStart = this.onExternalLinkDragStart.bind(this);
        this.onExternalLinkDragOver = this.onExternalLinkDragOver.bind(this);
        this.onExternalLinkDrop = this.onExternalLinkDrop.bind(this);
    }

    connectedCallback(){
        // set the id; NOTE: at the moment this is a random UUID
        this.setAttribute("id",  window.crypto.randomUUID());
        // for the moment every sheet has a CallStack which might or might not
        // make sense moving fwd
        // NOTE: it's the GridSheet in the shadow which (potentially) contains the commands
        // that is passed as the editor to CallStack
        this.callStack = new CallStack(this.shadowRoot.querySelector('my-grid'), this.commandRegistry);

        // set the sources and targets to ""
        this.setAttribute("sources", "");
        this.setAttribute("targets", "");

        // set the palette
        this.style.backgroundColor = this.palette.this;
        this.shadowRoot.querySelector('my-grid').style.backgroundColor = this.palette.sheet;

        const header = this.shadowRoot.querySelector('#header-bar');
        const name = header.querySelector('#title');
        const eraseButton = header.querySelector("#erase");
        const deleteButton = header.querySelector("#trash");
        const runButton = header.querySelector("#run");
        const footer = this.shadowRoot.querySelector('#footer-bar');
        // for drag & drop to work we need to select the span parent of the svg
        const externalLinkButton = footer.querySelector("#e-link");
        externalLinkButton.setAttribute("title", "drag and drop onto a sheet to link");

        // set the name to default
        this.updateName("The worksheet");

        // add event listeners
        header.addEventListener("mousedown", this.onMouseDownInHeader);
        name.addEventListener("dblclick", this.onNameDblClick);
        eraseButton.addEventListener("click", this.onErase);
        deleteButton.addEventListener("click", this.onDelete);
        runButton.addEventListener("click", this.onRun);
        externalLinkButton.setAttribute("draggable", true);
        externalLinkButton.addEventListener("dragstart", this.onExternalLinkDragStart);
        this.addEventListener("dragover", this.onExternalLinkDragOver);
        this.addEventListener("drop", this.onExternalLinkDrop);
    }

    disconnectedCallback(){
        // remove event listeners
        const header = this.shadowRoot.querySelector('#header-bar');
        const name = header.querySelector('span');
        const eraseButton = header.querySelector("#erase");
        const deleteButton = header.querySelector("#trash");
        const runButton = header.querySelector("#run");
        const footer = this.shadowRoot.querySelector('#footer-bar');
        // for drag & drop to work we need to select the span parent of the svg
        const externalLinkButton = footer.querySelector("#e-link");
        header.addEventListener("mousedown", this.onMouseDownInHeader);
        name.addEventListener("dblclick", this.onNameDblClick);
        eraseButton.addEventListener("click", this.onErase);
        deleteButton.addEventListener("click", this.onDelete);
        runButton.addEventListener("click", this.onRun);
        externalLinkButton.addEventListener("dragstart", this.onExternalLinkDragStart);
        this.addEventListener("dragover", this.onExternalLinkDragOver);
        this.addEventListener("drop", this.onExternalLinkDrop);
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
        const input = header.querySelector('input');
        input.classList.add('show');
        input.value = this.name;
        input.addEventListener('keydown', this.onNameKeydown);
        // input.addEventListener('blur', this.handleInputBlur);
        input.focus();
    }

    stopEditingName(){
        this.isEditingName = false;
        const header = this.shadowRoot.querySelector('#header-bar');
        const input = header.querySelector('input');
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
        this.shadowRoot.querySelector("my-grid").dataFrame.clear();
    }

    onRun(){
        if(!this.getAttribute("sources") || this.getAttribute("targets")){
            alert("You must have both sources and targets set to run!");
        }
        this.callStack.runAll(this.getAttribute("sources"), this.getAttribute("targets"));
    }

    onExternalLinkDragStart(event){
        event.dataTransfer.setData("id", this.id);
        event.dataTransfer.setData("name", this.name);
        event.dataTransfer.effectAllowed = "link";
    }

    onExternalLinkDragOver(event){
        event.preventDefault();
        event.dataTransfer.dropEffect = "link";
        console.log("drag over");
    }

    onExternalLinkDrop(event){
        event.preventDefault();
        // add the source
        const sourceId = event.dataTransfer.getData("id")
        const sourceName = event.dataTransfer.getData("name")
        this.addSource(sourceId, sourceName);
        // now tell the source to add me as a target
        // TODO: maybe all of this source/target adding/removing should be
        // handled with custom events...?
        const sourceSheet = document.getElementById(sourceId);
        sourceSheet.addTarget(this.id, this.name);
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
        const footer = this.shadowRoot.querySelector('#footer-bar');
        const sourcesArea = footer.querySelector('#sources');
        sourcesArea.appendChild(sourceSpan);
        return id;
    }

    removeSource(id){
        let sources = this._attributeToList("sources");
        sources = sources.filter((item) => {return item != id});
        this.setAttribute("sources", sources);
        // remove the source link
        const footer = this.shadowRoot.querySelector("#footer-bar");
        const linkContainer = footer.querySelector('#sources');
        linkContainer.querySelectorAll(`[data-id='${id}']`).forEach((item) => {item.remove()});
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
        const footer = this.shadowRoot.querySelector('#footer-bar');
        const targetsArea = footer.querySelector('#targets');
        const externalLinkButton = footer.querySelector("#e-link");
        targetsArea.insertBefore(targetSpan, externalLinkButton);
        return id;
    }

    removeTarget(id){
        let targets = this._attributeToList("targets");
        targets = targets.filter((item) => {return item != id});
        this.setAttribute("targets", targets);
        // remove the target link
        const footer = this.shadowRoot.querySelector("#footer-bar");
        const linkContainer = footer.querySelector('#targets');
        linkContainer.querySelectorAll(`[data-id='${id}']`).forEach((item) => {item.remove()});
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
        const icon = this._createIconSpanFromString(iconString);
        const iconSpan = document.createElement("span");
        iconSpan.appendChild(icon);
        iconSpan.setAttribute("data-type", type);
        iconSpan.setAttribute("data-id", id);
        iconSpan.setAttribute("title", `${type}: ${name} (${id})`);
        // overlay the unlink icon
        const unlinkIcon = this._createIconSpanFromString(icons.unlink);
        unlinkIcon.setAttribute("data-type", type);
        unlinkIcon.setAttribute("data-id", id);
        unlinkIcon.style.display = 'none';
        iconSpan.addEventListener("click", this.removeLink);
        iconSpan.appendChild(unlinkIcon);
        iconSpan.addEventListener("mouseover", () => {
            unlinkIcon.style.display = "inherit";
            icon.style.display = "none";
            sheet.style.outline = "solid var(--palette-blue)";
        })
        iconSpan.addEventListener("mouseleave", () => {
            unlinkIcon.style.display = "none";
            icon.style.display = "inherit";
            sheet.style.outline = "initial";
        })
        return iconSpan;
    }

    /**
      * I create a span element with svg element child from a svg string
      */
    _createIconSpanFromString(iconString){
        const template = document.createElement("template");
        template.innerHTML = iconString;
        const iconSVG = template.content.childNodes[0];
        const span = document.createElement("span");
        span.appendChild(iconSVG);
        span.setAttribute("data-clickable", true);
        return span;
    }
}

window.customElements.define("work-sheet", Worksheet);
