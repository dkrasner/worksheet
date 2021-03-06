/* Various interpreter to use with worksheet */
import {referenceGrammar} from './ohm/reference.js';
import {referenceSemantics} from './ohm/reference.js';
import {commandGrammar} from './ohm/command.js';
import {commandSemantics} from './ohm/command.js';

class BasicInterpreter extends Object {
    constructor(){
        super();

        this.interpret = this.interpret.bind(this);
        this.matchAndInterpretCommand = this.matchAndInterpretCommand.bind(this);
        this.matchAndInterpretReference = this.matchAndInterpretReference.bind(this);
    }

    interpret(instruction){
        // NOTE: [source, target, command] convention
        let [source, target, command] = instruction;
        command = this.matchAndInterpretCommand(command);
        const [name, args] = command;
        source = this.matchAndInterpretReference(source);
        target = this.matchAndInterpretReference(target);
        return function(){
            const exec = commandRegistry[name];
            return exec(source, target, args);
        };
    }

    matchAndInterpretCommand(s){
        const m = commandGrammar.match(s);
        if(m.failed()){
            alert(`I cannot parse ${s}`);
            // throw new Error(`NotUnderstood ${s}`);
            return;
        }
        const result = commandSemantics(m).interpret();
        if(!result){
            alert(`I cannot interpret ${s}`);
            // throw new Error(`NotKnown ${s}`);
            return;
        }
        return result;
    }

    matchAndInterpretReference(s){
        const m = referenceGrammar.match(s);
        if(m.failed()){
            alert(`I cannot parse ${s}`);
            // throw new Error(`NotUnderstood ${s}`);
            return;
        }
        const result = referenceSemantics(m).interpret();
        if(!result){
            alert(`I cannot interpret ${s}`);
            // throw new Error(`NotKnown ${s}`);
            return;
        }
        return result[0];
    }
}

const copy = (source, target) => {
    replace(source, target);
}

const replace = (source, target, d) => {
    const [sourceWSId, sourceWSSelection] = source;
    const [sourceWSAnchor, sourceWSCorner] = sourceWSSelection;
    const sourceWS = document.getElementById(sourceWSId);
    const [targetWSId, targetWSSelection] = target;
    const [targetWSAnchor, _] = targetWSSelection;
    const targetWS = document.getElementById(targetWSId);

    const sourceWSAnchorX = labelIndex(sourceWSAnchor[0]);
    const sourceWSCornerX = labelIndex(sourceWSCorner[0]);
    const sourceWSAnchorY = parseInt(sourceWSAnchor[1]) - 1;
    const sourceWSCornerY = parseInt(sourceWSCorner[1]) - 1;

    const targetWSAnchorX = labelIndex(targetWSAnchor[0]);
    const targetWSAnchorY = parseInt(targetWSAnchor[1]) - 1;
    // interate of source frame and insert into the target
    let y = sourceWSAnchorY;
    let ycounter = 0;
    while(y <= sourceWSCornerY){
        let x = sourceWSAnchorX;
        let xcounter = 0;
        while(x <= sourceWSCornerX){
            let entry = sourceWS.sheet.dataFrame.getAt([x, y]);
            if(entry && d){
                // run a replaceAll here
                // TODO switch to a regex in the future?
                for(const key in d){
                    entry = entry.replaceAll(key, d[key]);
                }
            }
            const targetX = targetWSAnchorX + xcounter;
            const targetY = targetWSAnchorY + ycounter;
            targetWS.sheet.dataFrame.putAt([targetX, targetY], entry, false);
            x += 1;
            xcounter += 1;
        }
        y += 1;
        ycounter += 1;
    }
    targetWS.sheet.render();
}

const commandRegistry = {
    "copy": copy,
    "replace": replace
}


// Utils
/* I take a string like s="AA" and return its 'true'
   column index */
const labelIndex = (s) => {
    return letters.indexOf(s[0]) + (letters.length * (s.length - 1));
};

const letters = [
    "A","B","C","D","E","F","G","H",
    "I","J","K","L","M","N","O","P",
    "Q","R","S","T","U","V","W","X",
    "Y","Z"
];


export {
    BasicInterpreter,
    BasicInterpreter as default
}
