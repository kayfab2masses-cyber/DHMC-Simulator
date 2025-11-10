// --- GLOBAL STATE ---
let party = []; // Our list of player characters
let adversaries = []; // Our new list of adversaries

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const runButton = document.getElementById('run-button');
    const addCharacterButton = document.getElementById('add-character-button');
    const addAdversaryButton = document.getElementById('add-adversary-button'); // NEW button

    runButton.addEventListener('click', runSimulation);
    addCharacterButton.addEventListener('click', addCharacterFromPaste);
    addAdversaryButton.addEventListener('click', addAdversaryFromPaste); // NEW event listener

    // Initial load for the default dire wolf
    loadDefaultAdversary();
});


/**
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
        newCharacter = JSON.parse(characterJsonText);
        // Basic validation: ensure it has a name and traits to be useful
        if (!newCharacter.name || !newCharacter.traits) {
            throw new Error('Character JSON is missing "name" or "traits" property.');
        }
    } catch (e) {
        logToScreen(`--- ERROR --- \nThe Character JSON is not valid. Could not parse. \nError: ${e.message}`);
        console.error("Character JSON parsing error:", e);
        return;
    }

    party.push(newCharacter);
    logToScreen(`Added ${newCharacter.name} (Lvl ${newCharacter.level || 'Unknown'}) to the party.`);
    jsonTextBox.value = ''; // Clear the text box
    updatePartyListUI();
}

/**
 * --- NEW FUNCTION ---
 * Adds an adversary from the text box to the global 'adversaries' array.
 */
function addAdversaryFromPaste() {
    const jsonTextBox = document.getElementById('adversary-json');
    const adversaryJsonText = jsonTextBox.value;

    if (!adversaryJsonText) {
        logToScreen('--- ERROR --- \nPlease paste your adversary JSON into the text box first.');
        return;
    }

    let newAdversary;
    try {
        newAdversary = JSON.parse(adversaryJsonText);
        // Basic validation: ensure it has a name and difficulty
        if (!newAdversary.name || !newAdversary.difficulty) {
            throw new Error('Adversary JSON is missing "name" or "difficulty" property.');
        }
    } catch (e) {
        logToScreen(`--- ERROR --- \nThe Adversary JSON is not valid. Could not parse. \nError: ${e.message}`);
        console.error("Adversary JSON parsing error:", e);
        return;
    }

    adversaries.push(newAdversary);
    logToScreen(`Added ${newAdversary.name} (Difficulty ${newAdversary.difficulty}) to the scene.`);
    jsonTextBox.value = ''; // Clear the text box
    updateAdversaryListUI();
}

/**
 * --- NEW FUNCTION ---
 * Loads the default Dire Wolf adversary automatically on page load.
 */
async function loadDefaultAdversary() {
    try {
        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        adversaries.push(direWolf);
        logToScreen(`Loaded default Adversary: ${direWolf.name} (Difficulty ${direWolf.difficulty})`);
        updateAdversaryListUI();
    } catch (error) {
        logToScreen(`--- ERROR --- Could not load default Dire Wolf: ${error.message}`);
        console.error("Error loading default dire wolf:", error);
    }
}


/**
 * Updates the "Current Party" list on the HTML page.
 */
function updatePartyListUI() {
    const partyListDiv = document.getElementById('party-list');
    partyListDiv.innerHTML = ''; // Clear the list first

    party.forEach(character => {
        const partyMemberDiv = document.createElement('div');
        partyMemberDiv.className = 'party-member';
        partyMemberDiv.textContent = `${character.name} (Lvl ${character.level || 'Unknown'} ${character.class || 'Unknown'})`;
        partyListDiv.appendChild(partyMemberDiv);
    });
}

/**
 * --- NEW FUNCTION ---
 * Updates the "Current Adversaries" list on the HTML page.
 */
function updateAdversaryListUI() {
    const adversaryListDiv = document.getElementById('adversary-list');
    adversaryListDiv.innerHTML = ''; // Clear the list first

    adversaries.forEach(adversary => {
        const adversaryMemberDiv = document.createElement('div');
        adversaryMemberDiv.className = 'adversary-member';
        adversaryMemberDiv.textContent = `${adversary.name} (Difficulty ${adversary.difficulty})`;
        adversaryListDiv.appendChild(adversaryMemberDiv);
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
        if (party.length === 0) {
            logToScreen('--- ERROR --- \nPlease add at least one player to the party before running.');
            return;
        }
        if (adversaries.length === 0) {
            logToScreen('--- ERROR --- \nPlease add at least one adversary to the scene before running.');
            return;
        }

        logToScreen(`Loaded Party with ${party.length} member(s):`);
        party.forEach(pc => {
            logToScreen(`- ${pc.name} (Lvl ${pc.level || 'Unknown'} ${pc.class || 'Unknown'})`);
        });

        logToScreen(`Loaded Adversaries with ${adversaries.length} member(s):`);
        adversaries.forEach(adv => {
            logToScreen(`- ${adv.name} (Difficulty ${adv.difficulty})`);
        });

        // --- 2. RUN SIMULATION LOGIC (TEST) ---
        // For our test, let's just have the FIRST player in the party act.
        // We'll also target the FIRST adversary in the list.
        
        const actingPlayer = party[0]; // Get the first player
        const targetAdversary = adversaries[0]; // Get the first adversary
        
        logToScreen(`\n--- TEST 1: ${actingPlayer.name} attempts an action against ${targetAdversary.name} ---`);
        
        // --- IMPORTANT: Debugging the 'undefined' issue ---
        // We need to ensure the character JSON actually has the spellcastTrait and its corresponding value.
        // If your "Booya" JSON doesn't have "spellcastTrait" defined, this will still be undefined.
        // We will make the `executeActionRoll` more robust later.
        const spellcastTrait = actingPlayer.spellcastTrait;
        const traitModifier = actingPlayer.traits ? actingPlayer.traits[spellcastTrait] : 0; // Safely get modifier

        logToScreen(`Rolling with ${spellcastTrait || 'UNKNOWN TRAIT'} (Modifier: ${traitModifier})`);
        logToScreen(`Target Difficulty: ${targetAdversary.difficulty}`);

        // Execute the core mechanic
        const result = executeActionRoll(targetAdversary.difficulty, traitModifier, 0);

        // --- 3. PROCESS OUTCOME ---
        logToScreen(`\nRoll Result: ${result.hopeRoll} (Hope) vs ${result.fearRoll} (Fear)`);
        logToScreen(`Total Roll: ${result.total} (vs ${result.difficulty})`);
        logToScreen(`Outcome: ${result.outcome}`);

        // Update resource changes based on outcome
        // (For now, these are just log messages, actual state change will come with the full combat loop)
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
        logToScreen(`\n--- UNEXPECTED SIMULATION ERROR ---
        ${error.message}`);
        console.error("Simulation error:", error);
    }
}

/**
 * Helper function to print messages to the on-screen log
 */
function logToScreen(message) {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.textContent += message + '\n';
        logOutput.scrollTop = logOutput.scrollHeight; // Scroll to bottom
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
 * It models the Duality Dice system and determines the outcome.
 *
 * @param {number} difficulty - The target Difficulty number.
 * @param {number} traitModifier - The character's relevant trait modifier (e.g., +2).
 * @param {number} otherModifiers - Any other modifiers (e.g., from Experiences or d6s).
 * @returns {object} An object containing the full results of the roll.
 */
function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    const hopeRoll = rollD12();
    const fearRoll = rollD12();

    // Ensure traitModifier and otherModifiers are numbers to prevent NaN
    const safeTraitModifier = typeof traitModifier === 'number' ? traitModifier : 0;
    const safeOtherModifiers = typeof otherModifiers === 'number' ? otherModifiers : 0;

    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + safeTraitModifier + safeOtherModifiers;
    let outcome = '';

    if (hopeRoll === fearRoll) {
        outcome = 'Critical Success';
    } else if (total >= difficulty) {
        outcome = (hopeRoll > fearRoll) ? 'Success with Hope' : 'Success with Fear';
    } else {
        outcome = (hopeRoll > fearRoll) ? 'Failure with Hope' : 'Failure with Fear';
    }

    return {
        hopeRoll, fearRoll, baseSum,
        traitModifier: safeTraitModifier,
        otherModifiers: safeOtherModifiers,
        total, difficulty, outcome
    };
}