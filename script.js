// --- GLOBAL STATE ---
// This is our list that will hold all the player objects.
let party = [];

// --- EVENT LISTENERS ---
// Wait for the HTML page to fully load
document.addEventListener('DOMContentLoaded', () => {
    // Find our buttons
    const runButton = document.getElementById('run-button');
    const addButton = document.getElementById('add-character-button');

    // Add click listeners to our buttons
    runButton.addEventListener('click', runSimulation);
    addButton.addEventListener('click', addCharacterFromPaste);
});


/**
 * --- NEW FUNCTION ---
 * Adds a character from the text box to the global 'party' array.
 */
function addCharacterFromPaste() {
    const jsonTextBox = document.getElementById('character-json');
    const characterJsonText = jsonTextBox.value;

    if (!characterJsonText) {
        logToScreen('--- ERROR --- \nPlease paste your character JSON into the text box first.');
        return;
    }

    let newCharacter;
    try {
        // Turn the text string from the box into a real JavaScript object
        newCharacter = JSON.parse(characterJsonText);
    } catch (e) {
        logToScreen(`--- ERROR --- \nThe Character JSON is not valid. Could not parse. \nError: ${e.message}`);
        return;
    }

    // Add the new character object to our 'party' list
    party.push(newCharacter);
    logToScreen(`Added ${newCharacter.name} to the party.`);

    // Clear the text box for the next paste
    jsonTextBox.value = '';

    // Update the UI to show the new party member
    updatePartyListUI();
}

/**
 * --- NEW FUNCTION ---
 * Updates the "Current Party" list on the HTML page.
 */
function updatePartyListUI() {
    const partyListDiv = document.getElementById('party-list');
    partyListDiv.innerHTML = ''; // Clear the list first

    party.forEach(character => {
        const partyMemberDiv = document.createElement('div');
        partyMemberDiv.className = 'party-member'; // So it gets styled
        partyMemberDiv.textContent = `${character.name} (Level ${character.level} ${character.class})`;
        partyListDiv.appendChild(partyMemberDiv);
    });
}


/**
 * Main function to run the simulation.
 */
async function runSimulation() {
    const logOutput = document.getElementById('log-output');
    logOutput.textContent = ''; // Clear the log
    logToScreen('Simulation starting...');

    try {
        // --- 1. LOAD DATA ---
        
        // --- MODIFIED: Check if the party is empty ---
        if (party.length === 0) {
            logToScreen('--- ERROR --- \nPlease add at least one player to the party before running.');
            return; // Stop the simulation
        }

        logToScreen(`Loaded Party with ${party.length} member(s):`);
        party.forEach(pc => {
            logToScreen(`- ${pc.name} (Lvl ${pc.level} ${pc.class})`);
        });

        // --- Load Adversary from file (still the same) ---
        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        logToScreen(`Loaded Adversary: ${direWolf.name} (Difficulty ${direWolf.difficulty})`);

        // --- 2. RUN SIMULATION LOGIC (TEST) ---
        // For our test, let's just have the FIRST player in the party act.
        // Later, we will build a "Combat Loop" that loops through everyone.
        
        const actingPlayer = party[0]; // Get the first player
        
        logToScreen(`\n--- TEST 1: ${actingPlayer.name} attempts an action... ---`);
        logToScreen(`Rolling with ${actingPlayer.spellcastTrait} (Modifier: ${actingPlayer.traits[actingPlayer.spellcastTrait]})`);
        logToScreen(`Target Difficulty: ${direWolf.difficulty}`);

        const traitModifier = actingPlayer.traits[actingPlayer.spellcastTrait];
        const result = executeActionRoll(direWolf.difficulty, traitModifier, 0);

        // --- 3. PROCESS OUTCOME ---
        logToScreen(`\nRoll Result: ${result.hopeRoll} (Hope) vs ${result.fearRoll} (Fear)`);
        logToScreen(`Total Roll: ${result.total} (vs ${result.difficulty})`);
        logToScreen(`Outcome: ${result.outcome}`);

        switch(result.outcome) {
            case 'Critical Success':
                logToScreen(`${actingPlayer.name} gains 1 Hope and clears 1 Stress.`);
                break;
            case 'Success with Hope':
                logToScreen(`${actingPlayer.name} gains 1 Hope.`);
                break;
            case 'Success with Fear':
                logToScreen('GM gains 1 Fear.');
                break;
            case 'Failure with Hope':
                logToScreen(`${actingPlayer.name} gains 1 Hope. Spotlight passes to GM.`);
                break;
            case 'Failure with Fear':
                logToScreen('GM gains 1 Fear. Spotlight passes to GM.');
                break;
        }

    } catch (error) {
        logToScreen(`\n--- UNEXPECTED ERROR ---
        ${error.message}`);
        console.error(error);
    }
}

/**
 * Helper function to print messages to the on-screen log
 */
function logToScreen(message) {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.textContent += message + '\n';
    }
}

/**
 * Rolls a virtual 12-sided die.
 * @returns {number} A random integer between 1 and 12.
 */
function rollD12() {
    return Math.floor(Math.random() * 12) + 1;
}

/**
 * This is the Core Resolution Engine.
 * @returns {object} An object containing the full results of the roll.
 */
function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    const hopeRoll = rollD12();
    const fearRoll = rollD12();
    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + traitModifier + otherModifiers;
    let outcome = '';

    if (hopeRoll === fearRoll) {
        outcome = 'Critical Success';
    } else if (total >= difficulty) { 
        outcome = (hopeRoll > fearRoll) ? 'Success with Hope' : 'Success with Fear';
    } else { 
        outcome = (hopeRoll > fearRoll) ? 'Failure with Hope' : 'Failure with Fear';
    }

    return {
        hopeRoll, fearRoll, baseSum, traitModifier, otherModifiers,
        total, difficulty, outcome
    };
}