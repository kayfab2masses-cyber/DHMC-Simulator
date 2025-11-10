// --- GLOBAL STATE ---
let playerPool = [];      // Column 2: Player Library
let adversaryPool = [];   // Column 2: Adversary Library
let activeParty = [];     // Column 3: Players in the next sim
let activeAdversaries = []; // Column 3: Adversaries in the next sim

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Column 1 Buttons
    document.getElementById('add-character-button').addEventListener('click', addCharacterToPool);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryToPool);
    
    // Main Run Button
    document.getElementById('run-button').addEventListener('click', runSimulation);
    
    // Column 2 & 3: Event delegation for dynamic buttons
    document.getElementById('pool-column').addEventListener('click', handlePoolClick);
    document.getElementById('scene-column').addEventListener('click', handleSceneClick);
    
    loadDefaultAdversary();
});

// --- DATA & POOL MANAGEMENT ---

function addCharacterToPool() {
    const jsonTextBox = document.getElementById('character-json');
    try {
        const newCharacter = JSON.parse(jsonTextBox.value);
        if (!newCharacter.name || !newCharacter.traits) throw new Error('JSON missing "name" or "traits"');
        
        // Add a unique ID for tracking
        newCharacter.simId = `player-${Date.now()}`;
        
        playerPool.push(newCharacter);
        logToScreen(`Added ${newCharacter.name} to Player Pool.`);
        jsonTextBox.value = '';
        renderPools(); // Update UI
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Character JSON. ${e.message}`); }
}

function addAdversaryToPool() {
    const jsonTextBox = document.getElementById('adversary-json');
    try {
        const newAdversary = JSON.parse(jsonTextBox.value);
        if (!newAdversary.name || !newAdversary.difficulty) throw new Error('JSON missing "name" or "difficulty"');
        
        newAdversary.simId = `adv-${Date.now()}`;
        
        adversaryPool.push(newAdversary);
        logToScreen(`Added ${newAdversary.name} to Adversary Pool.`);
        jsonTextBox.value = '';
        renderPools(); // Update UI
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Adversary JSON. ${e.message}`); }
}

async function loadDefaultAdversary() {
    if (adversaryPool.length > 0) return;
    try {
        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        direWolf.simId = `adv-${Date.now()}`;
        adversaryPool.push(direWolf);
        logToScreen(`Loaded default ${direWolf.name} into Adversary Pool.`);
        renderPools();
    } catch (error) { logToScreen(`--- ERROR --- Could not load default Dire Wolf: ${error.message}`); }
}

// --- DYNAMIC CLICK HANDLERS (Event Delegation) ---

function handlePoolClick(event) {
    const target = event.target;
    const agentId = target.dataset.id;
    if (!agentId) return; // Didn't click a button

    if (target.classList.contains('move-button')) {
        // Find in Player Pool
        let agentIndex = playerPool.findIndex(p => p.simId === agentId);
        if (agentIndex > -1) {
            const agent = playerPool.splice(agentIndex, 1)[0];
            activeParty.push(agent);
        } else {
            // Find in Adversary Pool
            agentIndex = adversaryPool.findIndex(a => a.simId === agentId);
            if (agentIndex > -1) {
                const agent = adversaryPool.splice(agentIndex, 1)[0];
                activeAdversaries.push(agent);
            }
        }
    }
    
    if (target.classList.contains('flush-button')) {
        // Find and remove from Player Pool
        let agentIndex = playerPool.findIndex(p => p.simId === agentId);
        if (agentIndex > -1) {
            const agent = playerPool.splice(agentIndex, 1)[0];
            logToScreen(`Flushed ${agent.name} from pool.`);
        } else {
            // Find and remove from Adversary Pool
            agentIndex = adversaryPool.findIndex(a => a.simId === agentId);
            if (agentIndex > -1) {
                const agent = adversaryPool.splice(agentIndex, 1)[0];
                logToScreen(`Flushed ${agent.name} from pool.`);
            }
        }
    }
    
    // Re-render both columns
    renderPools();
    renderActiveScene();
}

function handleSceneClick(event) {
    const target = event.target;
    const agentId = target.dataset.id;
    if (!agentId) return; // Didn't click a button

    if (target.classList.contains('move-button')) {
        // Find in Active Party
        let agentIndex = activeParty.findIndex(p => p.simId === agentId);
        if (agentIndex > -1) {
            const agent = activeParty.splice(agentIndex, 1)[0];
            playerPool.push(agent);
        } else {
            // Find in Active Adversaries
            agentIndex = activeAdversaries.findIndex(a => a.simId === agentId);
            if (agentIndex > -1) {
                const agent = activeAdversaries.splice(agentIndex, 1)[0];
                adversaryPool.push(agent);
            }
        }
    }
    
    // Re-render both columns
    renderPools();
    renderActiveScene();
}


// --- DYNAMIC UI RENDERING ---

function renderPools() {
    const playerListDiv = document.getElementById('player-pool-list');
    const adversaryListDiv = document.getElementById('adversary-pool-list');
    
    playerListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';

    playerPool.forEach(char => {
        playerListDiv.innerHTML += `
            <div class="pool-item">
                <span class="agent-name">${char.name} (Lvl ${char.level})</span>
                <button class="flush-button" data-id="${char.simId}">X</button>
                <button class="move-button" data-id="${char.simId}">Add to Scene &gt;</button>
            </div>
        `;
    });
    
    adversaryPool.forEach(adv => {
        adversaryListDiv.innerHTML += `
            <div class="pool-item">
                <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
                <button class="flush-button" data-id="${adv.simId}">X</button>
                <button class="move-button" data-id="${adv.simId}">Add to Scene &gt;</button>
            </div>
        `;
    });
}

function renderActiveScene() {
    const partyListDiv = document.getElementById('active-party-list');
    const adversaryListDiv = document.getElementById('active-adversary-list');
    
    partyListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';
    
    activeParty.forEach(char => {
        partyListDiv.innerHTML += `
            <div class="scene-item">
                <button class="move-button" data-id="${char.simId}">&lt; Remove</button>
                <span class="agent-name">${char.name} (Lvl ${char.level})</span>
            </div>
        `;
    });
    
    activeAdversaries.forEach(adv => {
        adversaryListDiv.innerHTML += `
            <div class="scene-item">
                <button class="move-button" data-id="${adv.simId}">&lt; Remove</button>
                <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
            </div>
        `;
    });
}

// --- PARSING & INSTANTIATION FUNCTIONS (Unchanged from last time) ---

function instantiatePlayerAgent(data) {
    let spellcastTrait = null;
    if (data.subclass.spellcast_trait) {
        spellcastTrait = data.subclass.spellcast_trait.toLowerCase();
    }
    let max_hp = data.class.starting_hp;
    if (data.advancementsTaken && data.advancementsTaken.add_hp) {
        max_hp += data.advancementsTaken.add_hp;
    }
    let max_stress = 6; 
    if (data.advancementsTaken && data.advancementsTaken.add_stress) {
        max_stress += data.advancementsTaken.add_stress;
    }
    if (data.subclass.foundation_feature.name.includes("At Ease")) {
        max_stress += 1;
    }
    let max_hope = 6;
    let current_hope = 2; 

    const agent = {
        id: data.simId, // Use the ID we gave it
        name: data.name,
        type: 'player',
        current_hp: max_hp,
        max_hp: max_hp,
        current_stress: 0, 
        max_stress: max_stress,
        current_hope: current_hope,
        max_hope: max_hope,
        armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, 
        current_armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, 
        traits: data.traits,
        spellcastTrait: spellcastTrait,
        proficiency: data.proficiency,
        evasion: data.evasion,
        thresholds: {
            major: data.majorThreshold,
            severe: data.severeThreshold
        },
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
        id: data.simId, // Use the ID we gave it
        type: 'adversary',
        current_hp: data.hp_max || data.hp, 
        max_hp: data.hp_max || data.hp,
        current_stress: 0,
        max_stress: data.stress_max || data.stress
    };
    return agent;
}

// --- SPOTLIGHT SIMULATION ENGINE (Unchanged from last time) ---

async function runSimulation() {
    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    // --- 1. VALIDATE & INSTANTIATE (NOW USES ACTIVE LISTS) ---
    if (activeParty.length === 0) { logToScreen('--- ERROR --- \nAdd a player to the Active Scene.'); return; }
    if (activeAdversaries.length === 0) { logToScreen('--- ERROR --- \nAdd an adversary to the Active Scene.'); return; }

    let playerAgents, adversaryAgents;
    try {
        // Create "live" instances *from the active lists*
        playerAgents = activeParty.map(instantiatePlayerAgent);
        adversaryAgents = activeAdversaries.map(instantiateAdversaryAgent);
    } catch (e) {
        logToScreen(`--- ERROR --- \nFailed to parse agent JSON. \n${e.message}`);
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
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Evasion: ${agent.evasion})`);
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

function executePCTurn(player, gameState) {
    const target = gameState.adversaries.find(a => a.current_hp > 0);
    if (!target) return 'COMBAT_OVER';

    logToScreen(`> ${player.name}'s turn (attacking ${target.name})...`);

    const traitName = player.primary_weapon.trait.toLowerCase();
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(`  Roll: ${traitName} (${traitMod}) | Total ${result.total} vs Diff ${result.difficulty} (${result.outcome})`);

    processRollResources(result, gameState, player);

    if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;
        let critBonus = 0; 

        if (result.outcome === 'CRITICAL_SUCCESS') {
            logToScreen('  CRITICAL HIT!');
            critBonus = parseDiceString(damageString).maxDie; 
        }

        const damageTotal = rollDamage(damageString, proficiency, critBonus); 
        applyDamage(damageTotal, player, target); 
    }
    
    return result.outcome; 
}

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
        let damageString = adversary.attack.damage;
        let critBonus = 0;

        if (roll === 20) { 
             logToScreen('  CRITICAL HIT!');
             critBonus = parseDiceString(damageString).maxDie;
        }

        const damageTotal = rollDamage(damageString, 1, critBonus); 
        applyDamage(damageTotal, adversary, target);
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
            player.current_stress = Math.max(0, player.current_stress - 1); 
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

function applyDamage(damageTotal, attacker, target) {
    let hpToMark = 0;
    
    if (damageTotal >= target.thresholds.severe) hpToMark = 3;
    else if (damageTotal >= target.thresholds.major) hpToMark = 2;
    else if (damageTotal > 0) hpToMark = 1;

    if (target.type === 'player' && target.current_armor_slots > 0 && hpToMark > 0) {
        // Simple Player AI: Use an Armor Slot if it helps reduce HP marked
        target.current_armor_slots--;
        hpToMark--;
        logToScreen(`  ${target.name} marks 1 Armor Slot to reduce damage! (Slots left: ${target.current_armor_slots})`);
    }
    
    target.current_hp -= hpToMark;
    
    logToScreen(`  Damage: ${damageTotal} (dealt by ${attacker.name}) vs Thresholds (${target.thresholds.major}/${target.thresholds.severe}) -> ${hpToMark} HP marked.`);
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

    if (hopeRoll === fearRoll) { outcome = 'CRITICAL_SUCCESS'; } 
    else if (total >= difficulty) { outcome = (hopeRoll > fearRoll) ? 'SUCCESS_WITH_HOPE' : 'SUCCESS_WITH_FEAR'; } 
    else { outcome = (hopeRoll > fearRoll) ? 'FAILURE_WITH_HOPE' : 'FAILURE_WITH_FEAR'; }

    return {
        hopeRoll, fearRoll, total, difficulty, outcome
    };
}

function rollDamage(damageString, proficiency, critBonus = 0) {
    const { numDice, dieType, modifier, maxDie } = parseDiceString(damageString);
    let totalDamage = 0;
    
    let diceToRoll = (proficiency > 1) ? (numDice * proficiency) : numDice;
    
    if (dieType > 0) {
        for (let i = 0; i < diceToRoll; i++) {
            totalDamage += Math.floor(Math.random() * dieType) + 1;
        }
    }
    
    totalDamage += modifier;
    totalDamage += critBonus; // Add the flat crit bonus here
    
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