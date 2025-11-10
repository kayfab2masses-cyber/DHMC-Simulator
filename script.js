// --- GLOBAL STATE ---
let party = []; // Holds the raw JSON data pasted by the user
let adversaries = []; // Holds the raw JSON data pasted by the user

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Find and set up all our buttons
    document.getElementById('run-button').addEventListener('click', runSimulation);
    document.getElementById('add-character-button').addEventListener('click', addCharacterFromPaste);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryFromPaste);
    loadDefaultAdversary();
});

// --- DATA INPUT & UI FUNCTIONS (No Changes) ---

function addCharacterFromPaste() {
    const jsonTextBox = document.getElementById('character-json');
    try {
        const newCharacter = JSON.parse(jsonTextBox.value);
        if (!newCharacter.name || !newCharacter.traits) throw new Error('JSON missing "name" or "traits"');
        party.push(newCharacter);
        logToScreen(`Added ${newCharacter.name} to party.`);
        jsonTextBox.value = '';
        updatePartyListUI();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Character JSON. ${e.message}`); }
}

function addAdversaryFromPaste() {
    const jsonTextBox = document.getElementById('adversary-json');
    try {
        const newAdversary = JSON.parse(jsonTextBox.value);
        if (!newAdversary.name || !newAdversary.difficulty) throw new Error('JSON missing "name" or "difficulty"');
        adversaries.push(newAdversary);
        logToScreen(`Added ${newAdversary.name} to scene.`);
        jsonTextBox.value = '';
        updateAdversaryListUI();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Adversary JSON. ${e.message}`); }
}

async function loadDefaultAdversary() {
    if (adversaries.length > 0) return;
    try {
        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        adversaries.push(direWolf);
        logToScreen(`Loaded default Adversary: ${direWolf.name}`);
        updateAdversaryListUI();
    } catch (error) { logToScreen(`--- ERROR --- Could not load default Dire Wolf: ${error.message}`); }
}

function updatePartyListUI() {
    const partyListDiv = document.getElementById('party-list');
    partyListDiv.innerHTML = '';
    party.forEach((character, index) => {
        const div = document.createElement('div');
        div.className = 'party-member';
        div.textContent = `${index + 1}: ${character.name} (Lvl ${character.level} ${character.class.name})`;
        partyListDiv.appendChild(div);
    });
}

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

// --- PARSING & INSTANTIATION FUNCTIONS (No Changes) ---

function instantiatePlayerAgent(data) {
    const spellcastTrait = data.subclass.spellcast_trait.toLowerCase();
    return {
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        name: data.name,
        type: 'player',
        current_hp: data.stats.hp,
        max_hp: data.stats.hp,
        current_stress: data.stats.stress,
        max_stress: data.stats.stress,
        armor_slots: data.equipment.armor.score,
        traits: data.traits,
        spellcastTrait: spellcastTrait,
        proficiency: data.proficiency,
        evasion: data.evasion,
        thresholds: { major: data.majorThreshold, severe: data.severeThreshold },
        primary_weapon: data.equipment.primary,
        features: data.features,
        domainCards: data.domainCards,
        experiences: data.experiences
    };
}

function instantiateAdversaryAgent(data) {
    return {
        ...data,
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'adversary',
        current_hp: data.hp_max || data.hp,
        max_hp: data.hp_max || data.hp,
        current_stress: data.stress_max || data.stress,
        max_stress: data.stress_max || data.stress
    };
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

    const playerAgents = party.map(instantiatePlayerAgent);
    const adversaryAgents = adversaries.map(instantiateAdversaryAgent);

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
    // This loop runs as long as combat isn't over.
    // It processes one "turn" (one spotlight) at a time.
    let simulationSteps = 0;
    while (!isCombatOver(gameState) && simulationSteps < 50) { // Added a safety break
        
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
                lastOutcome = 'pc_is_down'; // Skip this PC
            }
        }
        
        // --- 5. CONTROL FLOW DECISION ---
        // This is the core Daggerheart mechanic [cite: 19737-19742]
        determineNextSpotlight(lastOutcome, gameState);

        // Add a small delay so the log can be read (and to prevent browser freezes)
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
 * --- NEW ---
 * Decides who gets the spotlight next based on the last roll.
 */
function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(`  Control Flow: Last outcome was [${lastOutcome}]`);
    
    switch (lastOutcome) {
        case 'Critical Success':
        case 'Success with Hope':
        case 'pc_is_down':
            // Spotlight passes to the next PC in order
            const nextPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = nextPCIndex;
            logToScreen(`  Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'Success with Fear':
        case 'Failure with Hope':
        case 'Failure with Fear':
            // Spotlight is seized by the GM! [cite: 19739-19741, 21367, 21369]
            gameState.spotlight = 'GM';
            logToScreen(`  Spotlight seized by GM!`);
            break;
            
        case 'gm_turn_ends':
            // GM turn is over, spotlight returns to the *next* PC
            const returnPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = returnPCIndex;
            logToScreen(`  Spotlight returns to PC: ${gameState.players[returnPCIndex].name}`);
            break;
    }
}


/**
 * A simple "AI" for a PC's turn. Returns the roll outcome.
 */
function executePCTurn(player, gameState) {
    const target = gameState.adversaries.find(a => a.current_hp > 0);
    if (!target) return 'combat_over'; // No targets left

    logToScreen(`> ${player.name}'s turn (attacking ${target.name})...`);

    const traitName = player.spellcastTrait || Object.keys(player.traits)[0];
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(`  Roll: ${result.total} vs Diff ${result.difficulty} (${result.outcome})`);

    processRollResources(result, gameState);

    if (result.outcome === 'Critical Success' || result.outcome.startsWith('Success')) {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;

        if (result.outcome === 'Critical Success') {
            logToScreen('  CRITICAL HIT!');
            const critDamage = parseDiceString(damageString).maxDie;
            damageString += `+${critDamage}`;
        }

        const damageTotal = rollDamage(damageString, proficiency);
        applyDamage(damageTotal, target);
    }
    
    return result.outcome; // Return the outcome string for the loop
}

/**
 * A simple "AI" for a GM's turn. Returns 'gm_turn_ends'.
 */
function executeGMTurn(gameState) {
    // GM AI: 1. Find a living adversary. 2. Find a living player. 3. Attack.
    const adversary = gameState.adversaries.find(a => a.current_hp > 0);
    const target = gameState.players.find(p => p.current_hp > 0);
    
    if (!adversary || !target) return 'combat_over';

    logToScreen(`> GM SPOTLIGHT: ${adversary.name} acts (attacking ${target.name})...`);
    
    // We'll add Fear spending AI here later
    // For now, the GM just spotlights one adversary for free [cite: 19740]
    
    const roll = rollD20();
    const totalAttack = roll + adversary.attack.modifier;
    
    logToScreen(`  Roll: 1d20(${roll}) + ${adversary.attack.modifier} = ${totalAttack} vs Evasion ${target.evasion}`);

    if (totalAttack >= target.evasion) {
        logToScreen('  HIT!');
        const damageTotal = rollDamage(adversary.attack.damage, 1);
        applyDamage(damageTotal, target);
    } else {
        logToScreen('  MISS!');
    }
    
    return 'gm_turn_ends'; // Signal that the GM turn is over
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
function processRollResources(result, gameState) {
    switch (result.outcome) {
        case 'Critical Success':
        case 'Success with Hope':
        case 'Failure with Hope':
            gameState.hope = Math.min(6, gameState.hope + 1); // Max 6 hope
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'Success with Fear':
        case 'Failure with Fear':
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
    
    // Compare damage to thresholds [cite: 19751]
    if (damageTotal >= target.thresholds.severe) {
        hpToMark = 3;
    } else if (damageTotal >= target.thresholds.major) {
        hpToMark = 2;
    } else if (damageTotal > 0) { // Any non-zero damage is at least Minor
        hpToMark = 1;
    }

    // TODO: Implement Armor Slot mitigation logic [cite: 19752]
    
    target.current_hp -= hpToMark;
    
    logToScreen(`  Damage: ${damageTotal} vs Thresholds (${target.thresholds.major}/${target.thresholds.severe}) -> ${hpToMark} HP marked.`);
    logToScreen(`  ${target.name} HP: ${target.current_hp} / ${target.max_hp}`);

    if (target.current_hp <= 0) {
        logToScreen(`  *** ${target.name} has been defeated! ***`);
    }
}

// --- CORE DICE & PARSING UTILITIES ---

function rollD20() { return Math.floor(Math.random() * 20) + 1; }
function rollD12() { return Math.floor(Math.random() * 12) + 1; }

function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    const hopeRoll = rollD12();
    const fearRoll = rollD12();

    const safeTraitModifier = typeof traitModifier === 'number' ? traitModifier : 0;
    const safeOtherModifiers = typeof otherModifiers === 'number' ? otherModifiers : 0;

    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + safeTraitModifier + safeOtherModifiers;
    let outcome = '';

    if (hopeRoll === fearRoll) { outcome = 'Critical Success'; } 
    else if (total >= difficulty) { outcome = (hopeRoll > fearRoll) ? 'Success with Hope' : 'Success with Fear'; } 
    else { outcome = (hopeRoll > fearRoll) ? 'Failure with Hope' : 'Failure with Fear'; }

    return {
        hopeRoll, fearRoll, baseSum,
        traitModifier: safeTraitModifier,
        otherModifiers: safeOtherModifiers,
        total, difficulty, outcome
    };
}

function rollDamage(damageString, proficiency) {
    const { numDice, dieType, modifier, maxDie } = parseDiceString(damageString);
    let totalDamage = 0;
    let proficiencyDice = (proficiency === 0) ? 1 : proficiency; // PC attacks (Prof 1+)

    // For adversaries, their damage string (e.g., "1d6+2") already has the # of dice.
    // Their "proficiency" is 1 for our calculation.
    if (damageString.includes('d')) {
         // PC damage dice are multiplied by proficiency [cite: 21531]
         // Adversary damage dice are NOT (their proficiency is 1 for this function)
         let diceToRoll = (proficiency > 1) ? (numDice * proficiency) : numDice;
         
         for (let i = 0; i < diceToRoll; i++) {
            totalDamage += Math.floor(Math.random() * dieType) + 1;
         }
    }
    
    totalDamage += modifier;
    return totalDamage;
}

function parseDiceString(damageString = "1d4") {
    damageString = damageString.split(' ')[0];
    let numDice = 1, dieType = 4, modifier = 0;
    const modSplit = damageString.split('+');
    if (modSplit.length > 1) modifier = parseInt(modSplit[1]) || 0;
    const dicePart = modSplit[0];
    const dieSplit = dicePart.split('d');
    
    if (dieSplit[0] === '') { // Handle "d12+3" format
        numDice = 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (dieSplit.length > 1) { // Handle "1d12+3" format
        numDice = parseInt(dieSplit[0]) || 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else { // Handle "3" (no dice, just modifier)
        numDice = 0;
        dieType = 0;
        modifier = parseInt(dieSplit[0]) || 0;
    }
    return { numDice, dieType, modifier, maxDie: dieType };
}

function logToScreen(message) {
   const logOutput = document.getElementById('log-output');
   if (logOutput) {
       logOutput.textContent += message + '\n';
       logOutput.scrollTop = logOutput.scrollHeight; // Scroll to bottom
   }
}