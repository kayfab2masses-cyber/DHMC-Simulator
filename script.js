// --- GLOBAL STATE ---
let party = []; // Holds the raw JSON data pasted by the user
let adversaries = []; // Holds the raw JSON data pasted by the user

// --- EVENT LISTENERS ---
// This block runs when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Find and set up all our buttons
    document.getElementById('run-button').addEventListener('click', runSimulation);
    document.getElementById('add-character-button').addEventListener('click', addCharacterFromPaste);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryFromPaste);
    
    // Load the default adversary on page load
    loadDefaultAdversary();
});

// --- DATA INPUT & UI FUNCTIONS ---

/**
 * Adds a character from the text box to the global 'party' array.
 */
function addCharacterFromPaste() {
    const jsonTextBox = document.getElementById('character-json');
    try {
        const newCharacter = JSON.parse(jsonTextBox.value);
        // Basic validation: ensure it has a name and traits to be useful
        if (!newCharacter.name || !newCharacter.traits) throw new Error('JSON missing "name" or "traits"');
        
        party.push(newCharacter); // Add the raw JSON to the party
        logToScreen(`Added ${newCharacter.name} to party.`);
        jsonTextBox.value = ''; // Clear the text box
        updatePartyListUI();
    } catch (e) { 
        logToScreen(`--- ERROR --- \nInvalid Character JSON. ${e.message}`); 
    }
}

/**
 * Adds an adversary from the text box to the global 'adversaries' array.
 */
function addAdversaryFromPaste() {
    const jsonTextBox = document.getElementById('adversary-json');
    try {
        const newAdversary = JSON.parse(jsonTextBox.value);
        // Basic validation: ensure it has a name and difficulty
        if (!newAdversary.name || !newAdversary.difficulty) throw new Error('JSON missing "name" or "difficulty"');
        
        adversaries.push(newAdversary); // Add the raw JSON
        logToScreen(`Added ${newAdversary.name} to scene.`);
        jsonTextBox.value = ''; // Clear the text box
        updateAdversaryListUI();
    } catch (e) { 
        logToScreen(`--- ERROR --- \nInvalid Adversary JSON. ${e.message}`); 
    }
}

/**
 * Loads the default Dire Wolf adversary automatically on page load.
 */
async function loadDefaultAdversary() {
    // Only load if the list is empty
    if (adversaries.length > 0) return; 
    try {
        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        adversaries.push(direWolf);
        logToScreen(`Loaded default Adversary: ${direWolf.name}`);
        updateAdversaryListUI();
    } catch (error) { 
        logToScreen(`--- ERROR --- Could not load default Dire Wolf: ${error.message}`); 
    }
}

/**
 * Updates the "Current Party" list on the HTML page.
 */
function updatePartyListUI() {
    const partyListDiv = document.getElementById('party-list');
    partyListDiv.innerHTML = '';
    party.forEach((character, index) => {
        const div = document.createElement('div');
        div.className = 'party-member';
        // Use .class.name, which we know works from your JSON
        div.textContent = `${index + 1}: ${character.name} (Lvl ${character.level} ${character.class.name})`;
        partyListDiv.appendChild(div);
    });
}

/**
 * Updates the "Current Adversaries" list on the HTML page.
 */
function updateAdversaryListUI() {
    const adversaryListDiv = document.getElementById('adversary-list');
    adversaryListDiv.innerHTML = '';
    adversaries.forEach((adversary, index) => {
        const div = document.createElement('div');
        div.className = 'adversary-member';
        div.textContent = `${index + 1}: ${adversary.name} (Diff ${adversary.difficulty})`;
        adversaryListDiv.appendChild(div);
    });
}

// --- PARSING & INSTANTIATION FUNCTIONS ---

/**
 * This is our "parser" or "translator".
 * It takes the raw JSON from your builder and turns it into a clean "Agent"
 * that the simulator can use.
 */
function instantiatePlayerAgent(data) {
    // Find the spellcast trait from the subclass data
    const spellcastTrait = data.subclass.spellcast_trait.toLowerCase();
    
    // Create a new, clean "Agent" object
    const agent = {
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        name: data.name,
        type: 'player',
        // Live Combat Stats (using your builder's structure)
        current_hp: data.stats.hp,
        max_hp: data.stats.hp,
        current_stress: data.stats.stress,
        max_stress: data.stats.stress,
        armor_slots: data.equipment.armor.score,
        // Base Stats (using your builder's structure)
        traits: data.traits, // e.g., { strength: -1, agility: 0, ... }
        spellcastTrait: spellcastTrait, // e.g., "presence"
        proficiency: data.proficiency,
        evasion: data.evasion,
        thresholds: {
            major: data.majorThreshold,
            severe: data.severeThreshold
        },
        // We will parse these later
        primary_weapon: data.equipment.primary,
        features: data.features,
        domainCards: data.domainCards,
        experiences: data.experiences
    };
    return agent;
}

/**
 * Instantiates an adversary agent.
 */
function instantiateAdversaryAgent(data) {
    // We add current_hp/stress so we can track it during combat
    const agent = {
        ...data, // Copy all properties from the JSON (name, difficulty, etc.)
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'adversary',
        // Use hp_max if it exists, otherwise hp
        current_hp: data.hp_max || data.hp, 
        max_hp: data.hp_max || data.hp,
        current_stress: data.stress_max || data.stress,
        max_stress: data.stress_max || data.stress
    };
    return agent;
}


// --- *NEW* SPOTLIGHT SIMULATION ENGINE ---

/**
 * Main function to run the simulation.
 */
async function runSimulation() {
    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    // --- 1. VALIDATE & INSTANTIATE ---
    if (party.length === 0) { logToScreen('--- ERROR --- \nAdd a player.'); return; }
    if (adversaries.length === 0) { logToScreen('--- ERROR --- \nAdd an adversary.'); return; }

    let playerAgents, adversaryAgents;
    try {
        // This is where it was failing from your JSON
        playerAgents = party.map(instantiatePlayerAgent);
        adversaryAgents = adversaries.map(instantiateAdversaryAgent);
    } catch (e) {
        logToScreen(`--- ERROR --- \nFailed to parse pasted JSON. \nIs the 'subclass' or 'stats' data missing? \n${e.message}`);
        return;
    }
    
    // Create the central "Game State" object
    const gameState = {
        players: playerAgents,
        adversaries: adversaryAgents,
        hope: 2 * playerAgents.length, // Start with 2 Hope per PC
        fear: 1 * playerAgents.length, // Start with 1 Fear per PC
        spotlight: 0, // The spotlight starts on the first player (index 0)
        lastPlayerSpotlight: 0 // Tracks who to return to after a GM turn
    };

    logToScreen(`Simulation Initialized. Hope: ${gameState.hope}, Fear: ${gameState.fear}`);
    logToScreen(`--- COMBAT BEGINS ---`);
    logToScreen(`Spotlight starts on: ${gameState.players[0].name}`);

    // --- 2. RUN THE EVENT-DRIVEN COMBAT LOOP ---
    let simulationSteps = 0; // Safety break
    while (!isCombatOver(gameState) && simulationSteps < 50) {
        
        let lastOutcome = '';

        if (gameState.spotlight === 'GM') {
            // --- GM SPOTLIGHT PHASE ---
            lastOutcome = executeGMTurn(gameState);
        } else {
            // --- PC SPOTLIGHT PHASE ---
            const actingPlayer = gameState.players[gameState.spotlight];
            if (actingPlayer.current_hp > 0) {
                lastOutcome = executePCTurn(actingPlayer, gameState);
                gameState.lastPlayerSpotlight = gameState.spotlight; // Save who just went
            } else {
                lastOutcome = 'PC_DOWN'; // Skip this PC
            }
        }
        
        // --- 5. CONTROL FLOW DECISION ---
        determineNextSpotlight(lastOutcome, gameState);

        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
        simulationSteps++;
    }

    // --- 3. FINAL REPORT ---
    logToScreen('\n======================================');
    logToScreen('SIMULATION COMPLETE');
    logToScreen('======================================');
    logToScreen('Final Party State:');
    gameState.players.forEach(p => {
        logToScreen(`- ${p.name}: ${p.current_hp} / ${p.max_hp} HP`);
    });
    logToScreen('Final Adversary State:');
    gameState.adversaries.forEach(a => {
        logToScreen(`- ${a.name}: ${a.current_hp} / ${a.max_hp} HP`);
    });
    logToScreen(`Final Resources: ${gameState.hope} Hope, ${gameState.fear} Fear`);
}

/**
 * Decides who gets the spotlight next based on the last roll.
 * This is the core "event-driven control flow."
 */
function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(`  Control Flow: Last outcome was [${lastOutcome}]`);
    
    switch (lastOutcome) {
        case 'CRITICAL_SUCCESS':
        case 'SUCCESS_WITH_HOPE':
        case 'PC_DOWN':
            // Spotlight passes to the next PC in order
            const nextPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = nextPCIndex;
            logToScreen(`  Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'SUCCESS_WITH_FEAR':
        case 'FAILURE_WITH_HOPE':
        case 'FAILURE_WITH_FEAR':
            // Spotlight is seized by the GM!
            gameState.spotlight = 'GM';
            logToScreen(`  Spotlight seized by GM!`);
            break;
            
        case 'GM_TURN_COMPLETE':
            // GM turn is over, spotlight returns to the *next* PC
            const returnPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = returnPCIndex;
            logToScreen(`  Spotlight returns to PC: ${gameState.players[returnPCIndex].name}`);
            break;
        
        case 'COMBAT_OVER':
            // Do nothing, the loop will end
            break;
    }
}


/**
 * A simple "AI" for a PC's turn. Returns the roll outcome.
 */
function executePCTurn(player, gameState) {
    const target = gameState.adversaries.find(a => a.current_hp > 0);
    if (!target) return 'COMBAT_OVER'; // No targets left

    logToScreen(`> ${player.name}'s turn (attacking ${target.name})...`);

    // Simple AI: Use spellcast trait if available, otherwise primary weapon trait
    const traitName = player.spellcastTrait || player.primary_weapon?.trait?.toLowerCase() || Object.keys(player.traits)[0];
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(`  Roll: ${result.total} vs Diff ${result.difficulty} (${result.outcome})`);

    processRollResources(result, gameState, player); // Update Hope/Fear/Stress

    // Check for success
    if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;

        if (result.outcome === 'CRITICAL_SUCCESS') {
            logToScreen('  CRITICAL HIT!');
            const critDamage = parseDiceString(damageString).maxDie;
            damageString += `+${critDamage}`; // Add max die value
        }

        const damageTotal = rollDamage(damageString, proficiency);
        applyDamage(damageTotal, target);
    }
    
    return result.outcome; // Return the outcome string for the loop
}

/**
 * A simple "AI" for a GM's turn. Returns 'GM_TURN_COMPLETE'.
 */
function executeGMTurn(gameState) {
    const adversary = gameState.adversaries.find(a => a.current_hp > 0);
    const target = gameState.players.find(p => p.current_hp > 0);
    
    if (!adversary || !target) return 'COMBAT_OVER';

    logToScreen(`> GM SPOTLIGHT: ${adversary.name} acts (attacking ${target.name})...`);
    
    // TODO: Add GM Fear spend logic
    
    const roll = rollD20();
    const totalAttack = roll + adversary.attack.modifier;
    
    logToScreen(`  Roll: 1d20(${roll}) + ${adversary.attack.modifier} = ${totalAttack} vs Evasion ${target.evasion}`);

    if (totalAttack >= target.evasion) { // Check against Evasion
        logToScreen('  HIT!');
        const damageTotal = rollDamage(adversary.attack.damage, 1); // Adversary prof is 1 for this
        applyDamage(damageTotal, target);
    } else {
        logToScreen('  MISS!');
    }
    
    return 'GM_TURN_COMPLETE'; // Signal that the GM turn is over
}

/**
 * Checks if all members of one team are defeated.
 */
function isCombatOver(gameState) {
    const playersAlive = gameState.players.some(p => p.current_hp > 0);
    const adversariesAlive = gameState.adversaries.some(a => a.current_hp > 0);
    
    if (!playersAlive) {
        logToScreen('--- All players are defeated! ---');
        return true;
    }
    if (!adversariesAlive) {
        logToScreen('--- All adversaries are defeated! ---');
        return true;
    }
    return false;
}

/**
 * Updates the game state (Hope/Fear) based on a roll's outcome.
 */
function processRollResources(result, gameState, player) {
    switch (result.outcome) {
        case 'CRITICAL_SUCCESS':
            gameState.hope = Math.min(6, gameState.hope + 1); // Max 6 hope
            player.current_stress = Math.max(0, player.current_stress - 1); // Clear 1 Stress
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope}), ${player.name} clears 1 Stress.`);
            break;
        case 'SUCCESS_WITH_HOPE':
            gameState.hope = Math.min(6, gameState.hope + 1);
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'FAILURE_WITH_HOPE':
            gameState.hope = Math.min(6, gameState.hope + 1);
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'SUCCESS_WITH_FEAR':
            gameState.fear++;
            logToScreen(`  Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
        case 'FAILURE_WITH_FEAR':
            gameState.fear++;
            logToScreen(`  Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
    }
}

/**
 * Applies damage to a target and logs the result.
 */
function applyDamage(damageTotal, target) {
    let hpToMark = 0;
    
    // Compare damage to thresholds
    if (damageTotal >= target.thresholds.severe) {
        hpToMark = 3; // Severe damage
    } else if (damageTotal >= target.thresholds.major) {
        hpToMark = 2; // Major damage
    } else if (damageTotal > 0) { // Any non-zero damage is at least Minor
        hpToMark = 1; // Minor damage
    }

    // TODO: Implement Armor Slot mitigation logic
    
    target.current_hp -= hpToMark;
    
    logToScreen(`  Damage: ${damageTotal} vs Thresholds (${target.thresholds.major}/${target.thresholds.severe}) -> ${hpToMark} HP marked.`);
    logToScreen(`  ${target.name} HP: ${target.current_hp} / ${target.max_hp}`);

    if (target.current_hp <= 0) {
        logToScreen(`  *** ${target.name} has been defeated! ***`);
        // TODO: Implement Death Move logic for players
    }
}

// --- CORE DICE & PARSING UTILITIES ---

/**
 * Rolls a virtual 20-sided die.
 */
function rollD20() { 
    return Math.floor(Math.random() * 20) + 1; 
}

/**
 * Rolls a virtual 12-sided die.
 */
function rollD12() { 
    return Math.floor(Math.random() * 12) + 1; 
}

/**
 * The Core Resolution Engine. Returns a string for the outcome.
 */
function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    const hopeRoll = rollD12();
    const fearRoll = rollD12();
    const safeTraitModifier = typeof traitModifier === 'number' ? traitModifier : 0;
    const safeOtherModifiers = typeof otherModifiers === 'number' ? otherModifiers : 0;
    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + safeTraitModifier + safeOtherModifiers;
    let outcome = '';

    // The Conditional Matrix
    if (hopeRoll === fearRoll) { outcome = 'CRITICAL_SUCCESS'; } 
    else if (total >= difficulty) { outcome = (hopeRoll > fearRoll) ? 'SUCCESS_WITH_HOPE' : 'SUCCESS_WITH_FEAR'; } 
    else { outcome = (hopeRoll > fearRoll) ? 'FAILURE_WITH_HOPE' : 'FAILURE_WITH_FEAR'; }

    return {
        hopeRoll, fearRoll, total, difficulty, outcome
    };
}

/**
 * Calculates total damage based on a damage string (e.g., "1d6+2") and proficiency.
 */
function rollDamage(damageString, proficiency) {
    const { numDice, dieType, modifier, maxDie } = parseDiceString(damageString);
    let totalDamage = 0;
    
    // PC damage dice are multiplied by proficiency
    // Adversary proficiency is 1 for this function
    let diceToRoll = (proficiency > 1) ? (numDice * proficiency) : numDice;
    
    if (dieType > 0) {
        for (let i = 0; i < diceToRoll; i++) {
            totalDamage += Math.floor(Math.random() * dieType) + 1;
        }
    }
    
    totalDamage += modifier;
    return totalDamage;
}

/**
 * A helper utility to parse damage strings like "1d6+2" or "d12+3"
 */
function parseDiceString(damageString = "1d4") {
    // Remove "phy" or "mag" tags
    damageString = damageString.split(' ')[0]; 
    
    let numDice = 1;
    let dieType = 4;
    let modifier = 0;

    const modSplit = damageString.split('+');
    if (modSplit.length > 1) {
        modifier = parseInt(modSplit[1]) || 0;
    }
    
    const dicePart = modSplit[0];
    const dieSplit = dicePart.split('d');
    
    if (dieSplit[0] === '') { // Handle "d12+3" format
        numDice = 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (dieSplit.length > 1) { // Handle "1d12+3" format
        numDice = parseInt(dieSplit[0]) || 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (!damageString.includes('d')) { // Handle "3" (no dice, just modifier)
        numDice = 0;
        dieType = 0;
        modifier = parseInt(dieSplit[0]) || 0;
    }

    return { numDice, dieType, modifier, maxDie: dieType };
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