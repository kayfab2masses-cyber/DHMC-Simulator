// --- GLOBAL STATE ---
let party = []; // Holds the raw JSON data pasted by the user
let adversaries = []; // Holds the raw JSON data pasted by the user

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run-button').addEventListener('click', runSimulation);
    document.getElementById('add-character-button').addEventListener('click', addCharacterFromPaste);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryFromPaste);
    loadDefaultAdversary();
});

// --- DATA INPUT & UI FUNCTIONS ---

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

// --- PARSING & INSTANTIATION FUNCTIONS ---

/**
 * --- THIS IS THE NEW "BRAIN" ---
 * Takes the raw JSON from your builder and creates a clean "Agent"
 * that the simulator can use. This now matches your JSON structure.
 */
function instantiatePlayerAgent(data) {
    // 1. Fix for 'spellcast_trait: null'
    let spellcastTrait = null;
    if (data.subclass.spellcast_trait) {
        spellcastTrait = data.subclass.spellcast_trait.toLowerCase();
    }

    // 2. Calculate Max HP from your JSON structure
    let max_hp = data.class.starting_hp;
    if (data.advancementsTaken && data.advancementsTaken.add_hp) {
        max_hp += data.advancementsTaken.add_hp;
    }

    // 3. Calculate Max Stress from your JSON structure
    let max_stress = 6; // Daggerheart default
    if (data.advancementsTaken && data.advancementsTaken.add_stress) {
        max_stress += data.advancementsTaken.add_stress;
    }
    // Check for "At Ease" feature from Vengeance Guardian
    if (data.subclass.foundation_feature.name.includes("At Ease")) {
        max_stress += 1;
    }

    // 4. Set starting Hope (max is 6)
    let max_hope = 6;
    let current_hope = 2; // All PCs start with 2 Hope

    // 5. Create the agent
    const agent = {
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        name: data.name,
        type: 'player',
        
        // Live Combat Stats (Calculated)
        current_hp: max_hp,
        max_hp: max_hp,
        current_stress: 0, // Stress is tracked as "filled", so 0 is empty
        max_stress: max_stress,
        current_hope: current_hope,
        max_hope: max_hope,
        armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, // Get armor score
        current_armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, // Live tracker
        
        // Base Stats (Read directly from your JSON)
        traits: data.traits,
        spellcastTrait: spellcastTrait,
        proficiency: data.proficiency,
        evasion: data.evasion,
        thresholds: {
            major: data.majorThreshold,
            severe: data.severeThreshold
        },
        
        // Full data for AI to use later
        primary_weapon: data.equipment.primary,
        features: data.features,
        domainCards: data.domainCards,
        experiences: data.experiences
    };
    return agent;
}

function instantiateAdversaryAgent(data) {
    const agent = {
        ...data,
        id: `${data.name}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'adversary',
        current_hp: data.hp_max || data.hp,
        max_hp: data.hp_max || data.hp,
        current_stress: 0,
        max_stress: data.stress_max || data.stress
    };
    return agent;
}


// --- SPOTLIGHT SIMULATION ENGINE ---

async function runSimulation() {
    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    if (party.length === 0) { logToScreen('--- ERROR --- \nAdd a player.'); return; }
    if (adversaries.length === 0) { logToScreen('--- ERROR --- \nAdd an adversary.'); return; }

    let playerAgents, adversaryAgents;
    try {
        playerAgents = party.map(instantiatePlayerAgent);
        adversaryAgents = adversaries.map(instantiateAdversaryAgent);
    } catch (e) {
        logToScreen(`--- ERROR --- \nFailed to parse pasted JSON. \nThis usually means a key property is missing (like 'subclass' or 'class'). \n${e.message}`);
        console.error("Error during instantiation:", e);
        return;
    }
    
    const gameState = {
        players: playerAgents,
        adversaries: adversaryAgents,
        hope: 2 * playerAgents.length, 
        fear: 1 * playerAgents.length, 
        spotlight: 0, 
        lastPlayerSpotlight: 0 
    };

    logToScreen(`Simulation Initialized. Hope: ${gameState.hope}, Fear: ${gameState.fear}`);
    logToScreen('Instantiated Player Agents:');
    playerAgents.forEach(agent => {
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Evasion: ${agent.evasion}, Spell-Trait: ${agent.spellcastTrait || 'None'})`);
    });

    logToScreen('--- COMBAT BEGINS ---');
    logToScreen(`Spotlight starts on: ${gameState.players[0].name}`);

    let simulationSteps = 0; 
    while (!isCombatOver(gameState) && simulationSteps < 50) {
        let lastOutcome = '';
        if (gameState.spotlight === 'GM') {
            lastOutcome = executeGMTurn(gameState);
        } else {
            const actingPlayer = gameState.players[gameState.spotlight];
            if (actingPlayer.current_hp > 0) {
                lastOutcome = executePCTurn(actingPlayer, gameState);
                gameState.lastPlayerSpotlight = gameState.spotlight; 
            } else {
                lastOutcome = 'PC_DOWN'; 
            }
        }
        determineNextSpotlight(lastOutcome, gameState);
        await new Promise(resolve => setTimeout(resolve, 50)); 
        simulationSteps++;
    }

    logToScreen('\n======================================');
    logToScreen('SIMULATION COMPLETE');
    logToScreen('======================================');
    logToScreen('Final Party State:');
    gameState.players.forEach(p => {
        logToScreen(`- ${p.name}: ${p.current_hp} / ${p.max_hp} HP | ${p.current_stress} / ${p.max_stress} Stress`);
    });
    logToScreen('Final Adversary State:');
    gameState.adversaries.forEach(a => {
        logToScreen(`- ${a.name}: ${a.current_hp} / ${a.max_hp} HP`);
    });
    logToScreen(`Final Resources: ${gameState.hope} Hope, ${gameState.fear} Fear`);
}

function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(`  Control Flow: Last outcome was [${lastOutcome}]`);
    
    switch (lastOutcome) {
        case 'CRITICAL_SUCCESS':
        case 'SUCCESS_WITH_HOPE':
        case 'PC_DOWN':
            const nextPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = nextPCIndex;
            logToScreen(`  Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'SUCCESS_WITH_FEAR':
        case 'FAILURE_WITH_HOPE':
        case 'FAILURE_WITH_FEAR':
            gameState.spotlight = 'GM';
            logToScreen(`  Spotlight seized by GM!`);
            break;
            
        case 'GM_TURN_COMPLETE':
            const returnPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = returnPCIndex;
            logToScreen(`  Spotlight returns to PC: ${gameState.players[returnPCIndex].name}`);
            break;
        
        case 'COMBAT_OVER':
            break;
    }
}

/**
 * A simple "AI" for a PC's turn. Returns the roll outcome.
 * AI is updated to use the primary weapon trait.
 */
function executePCTurn(player, gameState) {
    const target = gameState.adversaries.find(a => a.current_hp > 0);
    if (!target) return 'COMBAT_OVER';

    logToScreen(`> ${player.name}'s turn (attacking ${target.name})...`);

    // AI v2: Use the primary weapon's trait for the attack.
    const traitName = player.primary_weapon.trait.toLowerCase();
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(`  Roll: ${traitName} (${traitMod}) | Total ${result.total} vs Diff ${result.difficulty} (${result.outcome})`);

    processRollResources(result, gameState, player);

    if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;

        if (result.outcome === 'CRITICAL_SUCCESS') {
            logToScreen('  CRITICAL HIT!');
            const critDamage = parseDiceString(damageString).maxDie;
            damageString += `+${critDamage}`; 
        }

        const damageTotal = rollDamage(damageString, proficiency);
        applyDamage(damageTotal, player, target); // Pass 'player' as the attacker
    }
    
    return result.outcome; 
}

/**
 * A simple "AI" for a GM's turn. Returns 'GM_TURN_COMPLETE'.
 */
function executeGMTurn(gameState) {
    const adversary = gameState.adversaries.find(a => a.current_hp > 0);
    const target = gameState.players.find(p => p.current_hp > 0);
    if (!adversary || !target) return 'COMBAT_OVER';

    logToScreen(`> GM SPOTLIGHT: ${adversary.name} acts (attacking ${target.name})...`);
    
    const roll = rollD20();
    const totalAttack = roll + adversary.attack.modifier;
    
    logToScreen(`  Roll: 1d20(${roll}) + ${adversary.attack.modifier} = ${totalAttack} vs Evasion ${target.evasion}`);

    if (totalAttack >= target.evasion) {
        logToScreen('  HIT!');
        const damageTotal = rollDamage(adversary.attack.damage, 1); 
        applyDamage(damageTotal, adversary, target); // Pass 'adversary' as the attacker
    } else {
        logToScreen('  MISS!');
    }
    
    return 'GM_TURN_COMPLETE'; 
}

function isCombatOver(gameState) {
    const playersAlive = gameState.players.some(p => p.current_hp > 0);
    const adversariesAlive = gameState.adversaries.some(a => a.current_hp > 0);
    
    if (!playersAlive) { logToScreen('--- All players are defeated! ---'); return true; }
    if (!adversariesAlive) { logToScreen('--- All adversaries are defeated! ---'); return true; }
    return false;
}

function processRollResources(result, gameState, player) {
    switch (result.outcome) {
        case 'CRITICAL_SUCCESS':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1); 
            player.current_stress = Math.max(0, player.current_stress - 1); // Clear 1 Stress
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope}), ${player.name} clears 1 Stress.`);
            break;
        case 'SUCCESS_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'FAILURE_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
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
 * Now includes simple Armor Slot AI.
 */
function applyDamage(damageTotal, attacker, target) {
    let hpToMark = 0;
    
    if (damageTotal >= target.thresholds.severe) hpToMark = 3;
    else if (damageTotal >= target.thresholds.major) hpToMark = 2;
    else if (damageTotal > 0) hpToMark = 1;

    // Simple Player AI: Use an Armor Slot if it helps
    if (target.type === 'player' && target.current_armor_slots > 0 && hpToMark > 0) {
        target.current_armor_slots--;
        hpToMark--;
        logToScreen(`  ${target.name} marks 1 Armor Slot to reduce damage! (Slots left: ${target.current_armor_slots})`);
    }
    
    target.current_hp -= hpToMark;
    
    logToScreen(`  Damage: ${damageTotal} (dealt by ${attacker.name}) vs Thresholds (${target.thresholds.major}/${target.thresholds.severe}) -> ${hpToMark} HP marked.`);
    logToScreen(`  ${target.name} HP: ${target.current_hp} / ${target.max_hp}`);

    if (target.current_hp <= 0) {
        logToScreen(`  *** ${target.name} has been defeated! ***`);
        // TODO: Implement Death Move logic for players
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

    if (hopeRoll === fearRoll) { outcome = 'CRITICAL_SUCCESS'; } 
    else if (total >= difficulty) { outcome = (hopeRoll > fearRoll) ? 'SUCCESS_WITH_HOPE' : 'SUCCESS_WITH_FEAR'; } 
    else { outcome = (hopeRoll > fearRoll) ? 'FAILURE_WITH_HOPE' : 'FAILURE_WITH_FEAR'; }

    return {
        hopeRoll, fearRoll, total, difficulty, outcome
    };
}

function rollDamage(damageString, proficiency) {
    const { numDice, dieType, modifier, maxDie } = parseDiceString(damageString);
    let totalDamage = 0;
    
    // PC damage dice are multiplied by proficiency
    let diceToRoll = (proficiency > 1) ? (numDice * proficiency) : numDice;
    
    if (dieType > 0) {
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
    
    if (dieSplit[0] === '') { 
        numDice = 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (dieSplit.length > 1) { 
        numDice = parseInt(dieSplit[0]) || 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (!damageString.includes('d')) { 
        numDice = 0; dieType = 0;
        modifier = parseInt(dieSplit[0]) || 0;
    }

    return { numDice, dieType, modifier, maxDie: dieType };
}

function logToScreen(message) {
   const logOutput = document.getElementById('log-output');
   if (logOutput) {
       logOutput.textContent += message + '\n';
       logOutput.scrollTop = logOutput.scrollHeight; 
   }
}