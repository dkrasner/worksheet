/**
 * WSConnection Component
 * -------------------------------------------
 * Custom Element describing connections between worksheets
 */
import LeaderLine from 'leader-line';

class WSConnection extends HTMLElement {
    constructor(){
        super();

        // Bound component methods
        this.updateLeaderLine = this.updateLeaderLine.bind(this);
        this.updateLinkedSheet = this.updateLinkedSheet.bind(this);
        this.onWorksheetMoved = this.onWorksheetMoved.bind(this);
    }

    connectedCallback(){
        if(this.isConnected){
            this.updateLinkedSheet(
                "",
                this.getAttribute("source")
            );
            this.updateLinkedSheet(
                "",
                this.getAttribute("destination")
            );
        }
    }

    disconnectedCallback(){
        this.updateLinkedSheet(
            this.getAttribute("source"),
            ""
        );
        this.updateLinkedSheet(
            this.getAttribute("destination")
        );
    }

    updateLeaderLine(){
        if(this.leaderLine){
            this.leaderLine.remove();
        }
        let sourceElement = document.getElementById(
            this.getAttribute('source')
        );
        let destElement = document.getElementById(
            this.getAttribute('destination')
        );
        if(sourceElement && destElement){
            console.log('Creating new leader-line between:');
            console.log(sourceElement, destElement);
            this.leaderLine = new LeaderLine(sourceElement, destElement);
        }
    }

    updateLinkedSheet(oldVal, newVal){
        console.log('updateLinkedSheet called!');
        console.log(`old: ${oldVal} new: ${newVal}`);
        if(this.isConnected && oldVal !== newVal){
            console.log('updating linked sheet', oldVal, newVal);
            const oldLinkedEl = document.getElementById(oldVal);
            if(oldLinkedEl){
                oldLinkedEl.removeEventListener('worksheet-moved', this.onWorksheetMoved);
            }
            const newLinkedEl = document.getElementById(newVal);
            if(newLinkedEl){
                newLinkedEl.addEventListener('worksheet-moved', this.onWorksheetMoved);
            }
        }
    }

    onWorksheetMoved(event){
        // When the worksheet moves, we need to redraw the leaderLine
        console.log('worksheet moved in connection element');
        this.leaderLine.position().show();
    }

    attributeChangedCallback(name, oldVal, newVal){
        if(name === "source" || name === "destination"){
            this.updateLeaderLine();
        }
        if(name === "source"){
            this.updateLinkedSheet(oldVal, newVal);
        }
        if(name === "destination"){
            this.updateLinkedSheet(oldVal, newVal);
        }
    }

    static get observedAttributes(){
        return [
            'source',
            'destination'
        ];
    }
};

window.customElements.define('ws-connection', WSConnection);

export {
    WSConnection as default
};
