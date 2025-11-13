// --- GLOBAL STATE ---
let playerPool = []; // Column 2: Player Library
let adversaryPool = []; // Column 2: Adversary Library
let activeParty = []; // Column 3: Players in the next sim
let activeAdversaries = []; // Column 3: Adversaries in the next sim
let SRD_ADVERSARIES = []; // This will hold our loaded SRD database
let PREMADE_CHARACTERS = []; // NEW: This will hold our loaded PC database

// --- BATTLEFIELD & RANGE CONFIGS ---
const DAGGERHEART_RANGES = {
    RANGE_MELEE: 1,
    RANGE_VERY_CLOSE: 3,
    RANGE_CLOSE: 6,      // Standard "free move" distance
    RANGE_FAR: 12        // "Full Action Move" distance
};

const MAP_CONFIGS = {
    small: { MAX_X: 15, MAX_Y: 15 },
    medium: { MAX_X: 20, MAX_Y: 20 },
    large: { MAX_X: 30, MAX_Y: 30 } // Our default
};

let CURRENT_BATTLEFIELD = {
    ...DAGGERHEART_RANGES,
    ...MAP_CONFIGS.large 
};
// --- END OF NEW CONFIGS ---


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Column 1 Buttons
    document.getElementById('add-character-button').addEventListener('click', addCharacterToPool);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryToPool);

    // Main Run Button
    document.getElementById('run-button').addEventListener('click', () => runMultipleSimulations(1));
    document.getElementById('run-multiple-button').addEventListener('click', () => runMultipleSimulations(3));
    document.getElementById('export-log-button').addEventListener('click', exportLog);

    // Column 2 & 3 Buttons
    document.getElementById('pool-column').addEventListener('click', handlePoolClick);
    document.getElementById('scene-column').addEventListener('click', handleSceneClick);
    document.getElementById('remove-character-button').addEventListener('click', removeLastCharacter);
    document.getElementById('remove-adversary-button').addEventListener('click', removeLastAdversary);

    // SRD Modal Listeners
    document.getElementById('open-srd-modal').addEventListener('click', openSRDModal);
    document.getElementById('close-srd-modal').addEventListener('click', closeSRDModal);
    document.getElementById('srd-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'srd-modal-overlay') closeSRDModal();
    });
    document.getElementById('srd-tier-filter').addEventListener('change', renderSRDAdversaries);
    document.getElementById('srd-type-filter').addEventListener('change', renderSRDAdversaries);
    document.getElementById('srd-adversary-list').addEventListener('click', handleSRDListClick);

    // PC Modal Listeners
    document.getElementById('open-pc-modal').addEventListener('click', openPCModal);
    document.getElementById('close-pc-modal').addEventListener('click', closePCModal);
    document.getElementById('pc-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'pc-modal-overlay') closePCModal();
    });
    document.getElementById('pc-catalog-list').addEventListener('click', handlePCListClick);

    // --- NEW: VISUALIZER TOGGLE ---
    document.getElementById('visualize-checkbox').addEventListener('change', (e) => {
        const logContainer = document.getElementById('log-container');
        const mapContainer = document.getElementById('visualizer-container');
        if (e.target.checked) {
            // Show Map, make log 50%
            logContainer.classList.remove('full-width');
            mapContainer.classList.remove('hidden');
        } else {
            // Hide Map, make log 100%
            logContainer.classList.add('full-width');
            mapContainer.classList.add('hidden');
        }
    });
    // --- END VISUALIZER TOGGLE ---

    loadSRDDatabase();
    loadPCDatabase();
    renderPools();
    renderActiveScene();
});

// --- DATA & POOL MANAGEMENT ---
async function loadSRDDatabase() {
    try {
        const response = await fetch('data/srd_adversaries.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            SRD_ADVERSARIES = data;
        } else {
            throw new Error("Invalid JSON structure. Expected a top-level array '[...]'");
        }

        logToScreen(`Successfully loaded ${SRD_ADVERSARIES.length} adversaries from SRD catalog.`);
        renderSRDAdversaries();
    } catch (error) {
        logToScreen(`--- FATAL ERROR --- Could not load SRD Adversary JSON: ${error.message}`);
        console.error("Failed to fetch SRD data:", error);
    }
}

async function loadPCDatabase() {
    try {
        const response = await fetch('data/premade_characters.json'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); 
        
        if (data && Array.isArray(data.players)) {
            PREMADE_CHARACTERS = data.players;
        } else {
            throw new Error("Invalid JSON structure. Expected an object with a top-level 'players' array.");
        }

        logToScreen(`Successfully loaded ${PREMADE_CHARACTERS.length} PCs from catalog.`);
        renderPCModalList();
    } catch (error) {
        logToScreen(`--- FATAL ERROR --- Could not load Premade PC JSON: ${error.message}`);
        console.error("Failed to fetch PC data:", error);
    }
}


function addCharacterToPool() {
    const jsonTextBox = document.getElementById('character-json');
    try {
        const newCharacter = JSON.parse(jsonTextBox.value);
        if (!newCharacter.name || !newCharacter.traits) throw new Error('JSON missing "name" or "traits"');
        
        const isDuplicate = playerPool.some(p => p.name === newCharacter.name);
        if (isDuplicate) {
            logToScreen(`--- ERROR --- \nA player named '${newCharacter.name}' is already in the pool.`);
            return;
        }
        
        newCharacter.simId = `player-${Date.now()}`;
        playerPool.push(newCharacter);
        logToScreen(`Added ${newCharacter.name} to Player Pool.`);
        jsonTextBox.value = '';
        renderPools();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Character JSON. ${e.message}`); }
}

function addAdversaryToPool() {
    const jsonTextBox = document.getElementById('adversary-json');
    try {
        const newAdversary = JSON.parse(jsonTextBox.value);
        if (!newAdversary.name || !newAdversary.difficulty) throw new Error('JSON missing "name" or "difficulty"');
        
        const isDuplicate = adversaryPool.some(a => a.name === newAdversary.name);
        if (isDuplicate) {
            logToScreen(`--- ERROR --- \nAn adversary named '${newAdversary.name}' is already in the pool.`);
            return;
        }

        newAdversary.simId = `adv-master-${Date.now()}`;
        adversaryPool.push(newAdversary);
        logToScreen(`Added ${newAdversary.name} to Adversary Pool.`);
        jsonTextBox.value = '';
        renderPools();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Adversary JSON. ${e.message}`); }
}

function removeLastCharacter() {
    if (playerPool.length > 0) {
        const removedChar = playerPool.pop();
        logToScreen(`Removed ${removedChar.name} from player pool.`);
        renderPools();
    } else { logToScreen("Player pool is already empty."); }
}

function removeLastAdversary() {
    if (adversaryPool.length > 0) {
        const removedAdv = adversaryPool.pop();
        logToScreen(`Removed ${removedAdv.name} from adversary pool.`);
        renderPools();
    } else { logToScreen("Adversary pool is already empty."); }
}

// --- DYNAMIC CLICK HANDLERS ---
function handlePoolClick(event) {
    const target = event.target;
    if (!target.closest('button')) return; 
    const agentItem = target.closest('.pool-item');
    if (!agentItem) return;
    const agentId = agentItem.dataset.id;
    if (!agentId) return; 

    if (target.classList.contains('move-button')) {
        let playerIndex = playerPool.findIndex(p => p.simId === agentId);
        if (playerIndex > -1) {
            const agent = playerPool.splice(playerIndex, 1)[0];
            activeParty.push(agent);
            logToScreen(`Moved ${agent.name} to Active Scene.`);
        } else {
            const agentTemplate = adversaryPool.find(a => a.simId === agentId);
            if (agentTemplate) {
                const newAgentInstance = JSON.parse(JSON.stringify(agentTemplate));
                newAgentInstance.simId = `adv-instance-${Date.now()}`; 
                activeAdversaries.push(newAgentInstance);
                logToScreen(`Copied ${newAgentInstance.name} to Active Scene.`);
            }
        }
    }

    if (target.classList.contains('flush-button')) {
        let playerIndex = playerPool.findIndex(p => p.simId === agentId);
        if (playerIndex > -1) {
            logToScreen(`Flushed ${playerPool.splice(playerIndex, 1)[0].name} from pool.`);
        } else {
            let adversaryIndex = adversaryPool.findIndex(a => a.simId === agentId);
            if (adversaryIndex > -1) {
                logToScreen(`Flushed ${adversaryPool.splice(adversaryIndex, 1)[0].name} from pool.`);
            }
        }
    }
    renderPools();
    renderActiveScene();
}

function handleSceneClick(event) {
    const target = event.target;
    if (!target.classList.contains('move-button')) return; 
    const agentItem = target.closest('.scene-item');
    if (!agentItem) return;
    
    const agentId = agentItem.dataset.id;
    if (!agentId) return;

    let playerIndex = activeParty.findIndex(p => p.simId === agentId);
    if (playerIndex > -1) {
        const agent = activeParty.splice(playerIndex, 1)[0];
        playerPool.push(agent);
        logToScreen(`Moved ${agent.name} back to Player Pool.`);
    } else {
        let adversaryIndex = activeAdversaries.findIndex(a => a.simId === agentId);
        if (adversaryIndex > -1) {
            const agent = activeAdversaries.splice(adversaryIndex, 1)[0];
            logToScreen(`Removed ${agent.name} instance from Active Scene.`);
        }
    }
    renderPools();
    renderActiveScene();
}

function handleSRDListClick(event) {
    const target = event.target.closest('.srd-item');
    if (!target) return;
    
    if (event.target.classList.contains('move-button')) {
        const advName = target.dataset.name;
        addAdversaryFromSRD(advName);
    }
}

function handlePCListClick(event) {
    const target = event.target.closest('.pc-item');
    if (!target) return;
    
    if (event.target.classList.contains('move-button')) {
        const pcName = target.dataset.name;
        addPlayerFromCatalog(pcName);
    }
}


// --- DYNAMIC UI RENDERING ---
function renderPools() {
    const playerListDiv = document.getElementById('player-pool-list');
    const adversaryListDiv = document.getElementById('adversary-pool-list');
    playerListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';

    playerPool.forEach(char => {
        playerListDiv.innerHTML += `
        <div class="pool-item" data-id="${char.simId}">
            <span class="agent-name">${char.name} (Lvl ${char.level})</span>
            <div class="pool-item-controls">
                <button class="flush-button" title="Remove from Pool">X</button>
                <button class="move-button" title="Add to Active Scene">&gt;</button>
            </div>
        </div>
        `;
    });

    adversaryPool.forEach(adv => {
        adversaryListDiv.innerHTML += `
        <div class="pool-item" data-id="${adv.simId}">
            <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
            <div class="pool-item-controls">
                <button class="flush-button" title="Remove from Pool">X</button>
                <button class="move-button" title="Add to Active Scene">&gt;</button>
            </div>
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
        <div class="scene-item" data-id="${char.simId}">
            <button class="move-button" title="Return to Pool">&lt;</button>
            <span class="agent-name">${char.name} (Lvl ${char.level})</span>
        </div>
        `;
    });

    activeAdversaries.forEach(adv => {
        adversaryListDiv.innerHTML += `
        <div class="scene-item" data-id="${adv.simId}">
            <button class="move-button" title="Return to Pool">&lt;</button>
            <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
        </div>
        `;
    });
}

// --- SRD Modal Functions ---
function openSRDModal() {
    document.getElementById('srd-modal-overlay').classList.remove('hidden');
}

function closeSRDModal() {
    document.getElementById('srd-modal-overlay').classList.add('hidden');
}

function renderSRDAdversaries() {
    const tier = document.getElementById('srd-tier-filter').value;
    const type = document.getElementById('srd-type-filter').value;
    const listDiv = document.getElementById('srd-adversary-list');
    listDiv.innerHTML = ''; 

    if (SRD_ADVERSARIES.length === 0) {
        listDiv.innerHTML = '<div class="pool-item"><span>Loading database...</span></div>';
        return;
    }

    const filteredList = SRD_ADVERSARIES.filter(adv => {
        const tierMatch = (tier === 'any' || adv.tier == tier);
        const typeMatch = (type === 'any' || adv.type.startsWith(type));
        return tierMatch && typeMatch;
    });

    if (filteredList.length === 0) {
        listDiv.innerHTML = '<div class="pool-item"><span>No adversaries match filters.</span></div>';
        return;
    }

    filteredList.forEach(adv => {
        let features = adv.features.map(f => `• ${f.name} (${f.type})`).join('\n');
        listDiv.innerHTML += `
        <div class="srd-item" data-name="${adv.name}">
            <span class="agent-name" title="${features}">${adv.name} (T${adv.tier})</span>
            <button class="move-button" title="Add to Adversary Pool">Add</button>
        </div>
        `;
    });
}

function addAdversaryFromSRD(name) {
    const advData = SRD_ADVERSARIES.find(a => a.name === name);
    if (!advData) return;
    
    const isDuplicate = adversaryPool.some(a => a.name === advData.name);
    if (isDuplicate) {
        logToScreen(`--- ERROR --- \n'${advData.name}' is already in the Adversary Pool.`);
        return;
    }

    const newAdversary = JSON.parse(JSON.stringify(advData));
    newAdversary.simId = `adv-master-${Date.now()}`;
    
    adversaryPool.push(newAdversary);
    logToScreen(`Added ${newAdversary.name} from SRD to Adversary Pool.`);
    renderPools(); 
    closeSRDModal(); 
}

// --- NEW: PC Modal Functions ---
function openPCModal() {
    document.getElementById('pc-modal-overlay').classList.remove('hidden');
}

function closePCModal() {
    document.getElementById('pc-modal-overlay').classList.add('hidden');
}

function renderPCModalList() {
    const listDiv = document.getElementById('pc-catalog-list');
    listDiv.innerHTML = ''; 

    if (PREMADE_CHARACTERS.length === 0) {
        listDiv.innerHTML = '<div class="pc-item"><span>Loading database...</span></div>';
        return;
    }

    PREMADE_CHARACTERS.forEach(pc => {
        listDiv.innerHTML += `
        <div class="pc-item" data-name="${pc.name}">
            <span class="agent-name">${pc.name} (Lvl ${pc.level} ${pc.class.name})</span>
            <button class="move-button" title="Add to Player Pool">Add</button>
        </div>
        `;
    });
}

function addPlayerFromCatalog(name) {
    const pcData = PREMADE_CHARACTERS.find(p => p.name === name);
    if (!pcData) return;
    
    const isDuplicate = playerPool.some(p => p.name === pcData.name);
    if (isDuplicate) {
        logToScreen(`--- ERROR --- \n'${pcData.name}' is already in the Player Pool.`);
        return;
    }

    const newPlayer = JSON.parse(JSON.stringify(pcData));
    newPlayer.simId = `player-${Date.now()}`;
    
    playerPool.push(newPlayer);
    logToScreen(`Added ${newPlayer.name} from Catalog to Player Pool.`);
    renderPools(); 
    closePCModal(); 
}


// --- PARSING & INSTANTIATION FUNCTIONS ---
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
    let current_hope = 2;
    const agent = {
        id: data.simId,
        name: data.name,
        type: 'player',
        current_hp: max_hp,
        max_hp: max_hp,
        current_stress: 0,
        max_stress: max_stress,
        current_hope: current_hope,
        max_hope: 6,
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
        experiences: data.experiences,
        conditions: [],
        position: {
            x: Math.floor(Math.random() * 3) + 1, 
            y: Math.floor(Math.random() * CURRENT_BATTLEFIELD.MAX_Y) + 1 
        },
        speed: DAGGERHEART_RANGES.RANGE_CLOSE 
    };
    return agent;
}

function instantiateAdversaryAgent(data) {
    const attackBonus = data.attack.bonus !== undefined
        ? data.attack.bonus
        : parseInt(data.attack.modifier) || 0;

    let agent = {
        ...data,
        id: data.simId,
        type: 'adversary',
        current_hp: data.hp,
        max_hp: data.hp,
        current_stress: 0,
        max_stress: data.stress,
        attack: {
            ...data.attack,
            modifier: attackBonus
        },
        conditions: [],
        passives: {},
        position: {
            x: CURRENT_BATTLEFIELD.MAX_X - Math.floor(Math.random() * 3),
            y: Math.floor(Math.random() * CURRENT_BATTLEFIELD.MAX_Y) + 1
        },
        speed: DAGGERHEART_RANGES.RANGE_CLOSE 
    };
    applyPassiveFeatures(agent);
    return agent;
}

function applyPassiveFeatures(agent) {
    if (!agent.features) return;
    for (const feature of agent.features) {
        if (feature.type === 'passive' && feature.parsed_effect) {
            for (const action of feature.parsed_effect.actions) {
                if (action.action_type === 'MODIFY_DAMAGE' && action.target === 'ALL_ATTACKS' && action.details.is_direct) {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. All attacks are DIRECT.)`);
                    agent.passives.allAttacksAreDirect = true;
                }
                if (action.action_type === 'MODIFY_STAT' && action.details.stat === 'resistance') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}.)`);
                    agent.passives.resistance = action.details.value;
                }
            }
        }
    }
}

// --- SPOTLIGHT SIMULATION ENGINE ---
async function runMultipleSimulations(count) {
    logToScreen(`\n===== STARTING BATCH OF ${count} SIMULATION(S) =====`);
    for (let i = 1; i <= count; i++) {
        logToScreen(`\n--- SIMULATION ${i} OF ${count} ---`);
        await runSimulation();
        // Only pause between sims if visualizing, otherwise go max speed
        const isVisualizing = document.getElementById('visualize-checkbox').checked;
        if (isVisualizing) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Longer pause between sims
        }
    }
    logToScreen(`\n===== BATCH COMPLETE =====`);
}

function exportLog() {
    const logOutput = document.getElementById('log-output');
    const logContent = logOutput.textContent;
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dhmc_simulation_log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logToScreen(`\n--- Log exported! ---`);
}

// --- *** MODIFIED: Reads visualizer settings *** ---
async function runSimulation() {
    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    // --- READ MAP & VISUALIZER SETTINGS ---
    const mapSize = document.getElementById('map-size-select').value;
    const isVisualizing = document.getElementById('visualize-checkbox').checked;
    
    // Set the global config for this sim run
    CURRENT_BATTLEFIELD = {
        ...DAGGERHEART_RANGES,
        ...MAP_CONFIGS[mapSize] 
    };

    if (isVisualizing) {
        // Set up the grid dimensions in the CSS
        const grid = document.getElementById('battlemap-grid');
        grid.style.gridTemplateColumns = `repeat(${CURRENT_BATTLEFIELD.MAX_X}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${CURRENT_BATTLEFIELD.MAX_Y}, 1fr)`;
        logToScreen(`Visualizing on ${mapSize} map (${CURRENT_BATTLEFIELD.MAX_X}x${CURRENT_BATTLEFIELD.MAX_Y})...`);
    } else {
        logToScreen(`Simulating on ${mapSize} map (${CURRENT_BATTLEFIELD.MAX_X}x${CURRENT_BATTLEFIELD.MAX_Y}) (Visuals disabled)...`);
    }
    // --- END SETTINGS ---

    if (activeParty.length === 0) { 
        logToScreen('--- ERROR --- \nAdd a player to the Active Scene.'); 
        return; 
    }
    if (activeAdversaries.length === 0) { 
        logToScreen('--- ERROR --- \nAdd an adversary to the Active Scene.'); 
        return; 
    }

    let playerAgents, adversaryAgents;
    try {
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
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Evasion: ${agent.evasion}) at Pos: (${agent.position.x}, ${agent.position.y})`);
    });
    logToScreen('Instantiated Adversary Agents:');
    adversaryAgents.forEach(agent => {
        const mod = agent.attack?.modifier;
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Diff: ${agent.difficulty}, Atk Mod: ${mod}) at Pos: (${agent.position.x}, ${agent.position.y})`);
    });

    logToScreen('--- COMBAT BEGINS ---');
    logToScreen(`Spotlight starts on: ${gameState.players[0].name}`);

    if (isVisualizing) {
        renderBattlemap(gameState);
    }

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
        
        // --- "BLAST VS. VIZ" CHECK ---
        if (isVisualizing) {
            renderBattlemap(gameState);
            // This pause is what lets us see the "dance"
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        if (isCombatOver(gameState)) {
            break;
        }
        
        simulationSteps++;
    }

    if (isVisualizing) {
        renderBattlemap(gameState); // Final render
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
        logToScreen(`- ${a.name}: ${a.current_hp} / ${a.max_hp} HP | ${a.current_stress} / ${a.max_stress} Stress`);
    });
    logToScreen(`Final Resources: ${gameState.hope} Hope, ${gameState.fear} Fear`);
}


function findNextLivingPC(gameState) {
    const { players, lastPlayerSpotlight } = gameState;
    let nextIndex = (lastPlayerSpotlight + 1) % players.length;
    
    for (let i = 0; i < players.length; i++) {
        if (players[nextIndex].current_hp > 0) {
            return nextIndex; // Found a living PC
        }
        nextIndex = (nextIndex + 1) % players.length;
    }
    
    return -1; // No players are left alive
}

function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(` Control Flow: Last outcome was [${lastOutcome}]`);
    
    if (isCombatOver(gameState)) {
        logToScreen(` --- Combat is Over ---`);
        return; 
    }

    let nextPCIndex;
    switch (lastOutcome) {
        case 'CRITICAL_SUCCESS':
        case 'PC_DOWN':
            nextPCIndex = findNextLivingPC(gameState);
            if (nextPCIndex === -1) return; 
            gameState.spotlight = nextPCIndex;
            logToScreen(` Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'SUCCESS_WITH_HOPE':
            if (gameState.fear > 0 && Math.random() < 0.5) { 
                logToScreen(`PC succeeded with Hope, but GM spends 1 Fear to seize the spotlight!`);
                gameState.fear--;
                logToScreen(` GM Fear: ${gameState.fear}`);
                gameState.spotlight = 'GM';
            } else {
                nextPCIndex = findNextLivingPC(gameState);
                if (nextPCIndex === -1) return; 
                gameState.spotlight = nextPCIndex;
                logToScreen(` Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            }
            break;

        case 'SUCCESS_WITH_FEAR':
        case 'FAILURE_WITH_HOPE': 
        case 'FAILURE_WITH_FEAR':
            gameState.spotlight = 'GM';
            logToScreen(` Spotlight seized by GM!`);
            break;

        case 'GM_TURN_COMPLETE':
            nextPCIndex = findNextLivingPC(gameState);
            if (nextPCIndex === -1) return; 
            gameState.spotlight = nextPCIndex;
            logToScreen(` Spotlight returns to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'COMBAT_OVER':
            break;
    }
}

// --- *** MODIFIED: Passes gameState to moveAgentTowards *** ---
function executePCTurn(player, gameState) {
    let targets = gameState.adversaries.filter(a => a.current_hp > 0);
    if (targets.length === 0) return 'COMBAT_OVER';
    
    const target = targets.sort((a, b) => {
        let distA = getAgentDistance(player, a);
        let distB = getAgentDistance(player, b);
        return distA - distB;
    })[0];

    logToScreen(`> ${player.name}'s turn (targeting ${target.name} at (${target.position.x}, ${target.position.y}))...`);

    const weaponRange = player.primary_weapon.range;
    if (isTargetInRange(player, target, weaponRange)) {
        logToScreen(` -> ${target.name} is in ${weaponRange} range. Attacking!`);
        
        const traitName = player.primary_weapon.trait.toLowerCase();
        const traitMod = player.traits[traitName];
        
        const result = executeActionRoll(target.difficulty, traitMod, 0);
        logToScreen(` Roll: ${traitName} (${traitMod}) | Total ${result.total} vs Diff ${target.difficulty} (${result.outcome})`);
        processRollResources(result, gameState, player);
        
        if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
            let damageString = player.primary_weapon?.damage || "1d4";
            let proficiency = player.proficiency;
            let critBonus = 0; 
            
            if (result.outcome === 'CRITICAL_SUCCESS') {
                logToScreen(' CRITICAL HIT!');
                critBonus = parseDiceString(damageString).maxDie; 
            }
            const damageTotal = rollDamage(damageString, proficiency, critBonus); 
            applyDamage(damageTotal, player, target, false); 
        }
        return result.outcome;
    } else {
        logToScreen(` -> ${target.name} is out of ${weaponRange} range.`);
        moveAgentTowards(player, target, gameState); // Pass gameState
        
        logToScreen(` -> Making Agility roll to move...`);
        const result = executeActionRoll(10, player.traits.agility || 0, 0); 
        logToScreen(` Roll: agility (0) | Total ${result.total} vs Diff 10 (${result.outcome})`);
        processRollResources(result, gameState, player);
        return result.outcome;
    }
}

function executeGMTurn(gameState) {
    logToScreen(`> GM SPOTLIGHT:`);
    
    let adversaryToAct = getAdversaryToAct(gameState);
    if (adversaryToAct) {
        performAdversaryAction(adversaryToAct.adversary, adversaryToAct.target, gameState);
    } else {
        logToScreen(` (No living adversaries or players left.)`);
        return 'COMBAT_OVER'; 
    }

    let spotlightedAdversaries = [adversaryToAct.adversary.id]; 
    while (gameState.fear > 0 && !isCombatOver(gameState)) {
        if (Math.random() < 0.5) { 
            logToScreen(` GM decides to spend 1 Fear for an *additional* spotlight...`);
            gameState.fear--;
            logToScreen(` GM Fear: ${gameState.fear}`);
            
            let additionalAdversary = getAdversaryToAct(gameState, spotlightedAdversaries);
            if (additionalAdversary) {
                spotlightedAdversaries.push(additionalAdversary.adversary.id);
                performAdversaryAction(additionalAdversary.adversary, additionalAdversary.target, gameState);
            } else {
                logToScreen(` (No living adversaries or players left.)`);
                return 'COMBAT_OVER';
            }
        } else {
            logToScreen(` GM chooses to hold their Fear and pass the spotlight.`);
            break; 
        }
    }
    
    return 'GM_TURN_COMPLETE'; 
}

function getAdversaryToAct(gameState, actedThisTurn = []) {
    const livingPlayers = gameState.players.filter(p => p.current_hp > 0);
    if (livingPlayers.length === 0) return null; 

    let livingAdversaries = gameState.adversaries.filter(a => a.current_hp > 0);
    if (livingAdversaries.length === 0) return null; 

    let availableAdversaries = livingAdversaries.filter(a => !actedThisTurn.includes(a.id));
    
    let adversary;
    if (availableAdversaries.length > 0) {
        adversary = availableAdversaries[Math.floor(Math.random() * availableAdversaries.length)];
    } else {
        logToScreen(` (All adversaries have acted, picking one at random to act again...)`);
        adversary = livingAdversaries[Math.floor(Math.random() * livingAdversaries.length)];
    }

    const target = livingPlayers.sort((a, b) => {
        let distA = getAgentDistance(adversary, a);
        let distB = getAgentDistance(adversary, b);
        return distA - distB;
    })[0];

    return { adversary, target };
}

// --- *** MODIFIED: Passes gameState to moveAgentTowards *** ---
function performAdversaryAction(adversary, target, gameState) {
    logToScreen(` Spotlight is on: ${adversary.name} (targeting ${target.name} at (${target.position.x}, ${target.position.y}))...`);

    const allActions = adversary.features.filter(f => f.type === 'action' && f.parsed_effect);

    const affordableAndInRangeActions = allActions.filter(f => {
        if (f.cost) {
            if (f.cost.type === 'stress' && (adversary.current_stress + f.cost.value > adversary.max_stress)) {
                return false; 
            }
            if (f.cost.type === 'fear' && (gameState.fear < f.cost.value)) {
                return false; 
            }
        }
        
        const firstEffect = f.parsed_effect.actions[0];
        const range = (firstEffect && firstEffect.range) ? firstEffect.range : 'Melee';

        if (range.toLowerCase() === "self") return true; 

        if (!isTargetInRange(adversary, target, range)) {
            logToScreen(` (Skipping ${f.name}: Target is out of ${range} range.)`);
            return false; 
        }
        
        if (firstEffect.details) {
            if (firstEffect.details.target_condition && !target.conditions.includes(firstEffect.details.target_condition)) {
                logToScreen(` (Skipping ${f.name}: Target is not ${firstEffect.details.target_condition})`);
                return false; 
            }
        }
        return true; 
    });

    let chosenAction = null;
    if (affordableAndInRangeActions.length > 0) {
        chosenAction = affordableAndInRangeActions[Math.floor(Math.random() * affordableAndInRangeActions.length)];
    }

    if (chosenAction) {
        logToScreen(` -> Using Feature: ${chosenAction.name}!`);
        if (chosenAction.cost) {
            if (chosenAction.cost.type === 'stress') {
                adversary.current_stress += chosenAction.cost.value;
                logToScreen(` ${adversary.name} marks ${chosenAction.cost.value} Stress (Total: ${adversary.current_stress})`);
            } else if (chosenAction.cost.type === 'fear') {
                gameState.fear -= chosenAction.cost.value;
                logToScreen(` GM spends ${chosenAction.cost.value} Fear for the feature (Total: ${gameState.fear})`);
            }
        }
        
        for (const action of chosenAction.parsed_effect.actions) {
            executeParsedEffect(action, adversary, target, gameState);
        }
    } else {
        const weaponRange = adversary.attack.range || 'Melee';
        if (isTargetInRange(adversary, target, weaponRange)) {
            logToScreen(` -> No features available. Target is in ${weaponRange} range. Defaulting to basic attack.`);
            executeGMBasicAttack(adversary, target);
        } else {
            logToScreen(` -> No features available. Target is out of ${weaponRange} range.`);
            moveAgentTowards(adversary, target, gameState); // Pass gameState
        }
    }
}

// --- *** MODIFIED: Passes gameState to moveAgentTowards *** ---
function executeParsedEffect(action, adversary, target, gameState) {
    let primaryTarget = target; 
    let targets = [target]; 

    if (action.target === "ALL_IN_RANGE" || action.target === "ALL_IN_RANGE_FRONT") {
        const actionRange = action.range || 'Very Close';
        targets = gameState.players.filter(p => p.current_hp > 0 && isTargetInRange(adversary, p, actionRange));
        logToScreen(` -> Action targets ${targets.length} players in ${actionRange} range!`);
    }

    switch (action.action_type) {
        case 'ATTACK_ROLL':
            for (const t of targets) {
                logToScreen(` Making an attack roll against ${t.name}...`);
                const roll = rollD20();
                const modifier = adversary.attack.modifier || 0;
                const totalAttack = roll + modifier;
                logToScreen(` Roll: 1d20(${roll}) + ${modifier} = ${totalAttack} vs Evasion ${t.evasion}`);
                
                if (totalAttack >= t.evasion) {
                    logToScreen(' HIT!');
                    if (action.details.on_success) {
                        for (const successAction of action.details.on_success) {
                            executeParsedEffect(successAction, adversary, t, gameState);
                        }
                    }
                } else {
                    logToScreen(' MISS!');
                    if (action.details.on_fail) {
                        const onFailActions = Array.isArray(action.details.on_fail) ? action.details.on_fail : [action.details.on_fail];
                        for (const failAction of onFailActions) {
                            executeParsedEffect(failAction, adversary, t, gameState);
                        }
                    }
                }
            }
            break;

        case 'FORCE_REACTION_ROLL':
            for (const t of targets) {
                const details = action.details;
                const difficulty = details.difficulty || 12; 
                logToScreen(` ${t.name} must make a ${details.roll_type.toUpperCase()} Reaction Roll (Diff ${difficulty})...`);
                
                const reactionSuccess = executeReactionRoll(t, details.roll_type, difficulty);
                
                if (reactionSuccess) {
                    logToScreen(` ${t.name} succeeds the Reaction Roll!`);
                    if (details.on_success) {
                        const onSuccessActions = Array.isArray(details.on_success) ? details.on_success : [details.on_success];
                        for (const successAction of onSuccessActions) {
                            executeParsedEffect(successAction, adversary, t, gameState);
                        }
                    }
                } else {
                    logToScreen(` ${t.name} fails the Reaction Roll!`);
                    if (details.on_fail) {
                        const onFailActions = Array.isArray(details.on_fail) ? details.on_fail : [details.on_fail];
                        for (const failAction of onFailActions) {
                            executeParsedEffect(failAction, adversary, t, gameState);
                        }
                    }
                }
            }
            break;

        case 'DEAL_DAMAGE':
            let critBonus = 0; 
            let damageTotal;

            if (action.damage_string === 'half') {
                logToScreen(` (Logic Error: 'half' damage is not yet implemented. Dealing 1 damage.)`);
                damageTotal = 1; 
            } else if (action.damage_string.includes("stress") || action.damage_string.includes("HP")) {
                const parts = action.damage_string.split(' ');
                const value = parseInt(parts[0]) || 1;
                if (parts[1].toLowerCase() === 'stress') {
                    logToScreen(` Dealing ${value} DIRECT Stress!`);
                    target.current_stress = Math.min(target.max_stress, target.current_stress + value);
                    logToScreen(` ${target.name} Stress: ${target.current_stress} / ${target.max_stress}`);
                    return; 
                } else { 
                    damageTotal = value;
                }
            } else {
                damageTotal = rollDamage(action.damage_string, 1, critBonus);
            }
            
            const isDirect = action.is_direct || adversary.passives.allAttacksAreDirect || false;
            
            if (damageTotal > 0) {
                logToScreen(` Dealing ${damageTotal} ${isDirect ? 'DIRECT' : ''} damage!`);
                applyDamage(damageTotal, adversary, primaryTarget, isDirect);
            } else {
                logToScreen(` Damage roll was 0, no damage dealt.`);
            }
            break;

        case 'DEAL_STRESS': 
            const stressVal = action.value || 0;
            if (stressVal > 0) {
                logToScreen(` Dealing ${stressVal} DIRECT Stress!`);
                target.current_stress = Math.min(target.max_stress, target.current_stress + stressVal);
                logToScreen(` ${target.name} Stress: ${target.current_stress} / ${target.max_stress}`);
            }
            break;

        case 'APPLY_CONDITION':
            if (action.cost) {
                if (action.cost.type === 'stress' && adversary.current_stress + action.cost.value <= adversary.max_stress) {
                    adversary.current_stress += action.cost.value;
                    logToScreen(` ${adversary.name} marks ${action.cost.value} Stress (Total: ${adversary.current_stress})`);
                    applyCondition(primaryTarget, action.condition);
                } else {
                    logToScreen(` ${adversary.name} could not afford Stress cost to apply ${action.condition}.`);
                }
            } else {
                applyCondition(primaryTarget, action.condition);
            }
            break;
            
        case 'MOVE':
            logToScreen(` -> ${adversary.name} is moving as part of an action...`);
            moveAgentTowards(adversary, primaryTarget, gameState); // Pass gameState
            break;

        case 'FORCE_MARK_ARMOR_SLOT':
            if (primaryTarget.current_armor_slots > 0) {
                primaryTarget.current_armor_slots--;
                logToScreen(` ${primaryTarget.name} is forced to mark 1 Armor Slot! (Slots left: ${primaryTarget.current_armor_slots})`);
            } else {
                logToScreen(` ${primaryTarget.name} has no Armor Slots to mark!`);
                if (action.on_fail) {
                    for (const failAction of action.on_fail.actions) {
                        executeParsedEffect(failAction, adversary, primaryTarget, gameState);
                    }
                }
            }
            break;

        case 'GAIN_FEAR':
            gameState.fear += action.value || 1;
            logToScreen(`GM gains ${action.value || 1} Fear (Total: ${gameState.fear})`);
            break;

        default:
            logToScreen(` (Logic for action_type '${action.action_type}' not yet implemented.)`);
    }
}

function applyCondition(target, condition) {
    if (!target.conditions.includes(condition)) {
        target.conditions.push(condition);
        logToScreen(` ${target.name} is now ${condition}!`);
    }
}

function executeGMBasicAttack(adversary, target) {
    const roll = rollD20();
    const modifier = adversary.attack.modifier || 0;
    const totalAttack = roll + modifier; 
    
    logToScreen(` Roll: 1d20(${roll}) + ${modifier} = ${totalAttack} vs Evasion ${target.evasion}`);
    
    if (totalAttack >= target.evasion) {
        logToScreen(' HIT!');
        let damageString = adversary.attack.damage;
        let critBonus = 0;
        
        if (roll === 20) { 
            logToScreen(' CRITICAL HIT!');
            critBonus = parseDiceString(damageString).maxDie;
        }
        const damageTotal = rollDamage(damageString, 1, critBonus); 
        
        const isDirect = adversary.passives.allAttacksAreDirect || false;
        
        applyDamage(damageTotal, adversary, target, isDirect);
    } else {
        logToScreen(' MISS!');
    }
}

// --- CORE SIMULATION FUNCTIONS ---
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

function processRollResources(result, gameState, player) {
    switch (result.outcome) {
        case 'CRITICAL_SUCCESS':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            player.current_stress = Math.max(0, player.current_stress - 1); 
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope}), ${player.name} clears 1 Stress.`);
            break;
        case 'SUCCESS_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'FAILURE_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'SUCCESS_WITH_FEAR':
            gameState.fear++;
            logToScreen(` Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
        case 'FAILURE_WITH_FEAR':
            gameState.fear++;
            logToScreen(` Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
    }
}

function applyDamage(damageTotal, attacker, target, isDirectDamage = false) {
    let hpToMark = 0;
    
    if (!target.thresholds) {
        logToScreen(` (ERROR: Target ${target.name} has no thresholds defined!)`);
        if (damageTotal > 0) hpToMark = 1; 
    } else {
        if (target.thresholds.severe && damageTotal >= target.thresholds.severe) hpToMark = 3;
        else if (target.thresholds.major && damageTotal >= target.thresholds.major) hpToMark = 2;
        else if (damageTotal > 0) hpToMark = 1;
    }
    
    let originalHPMark = hpToMark;
    logToScreen(` Damage: ${damageTotal} (dealt by ${attacker.name}) vs Thresholds (${target.thresholds.major}/${target.thresholds.severe})`);
    logToScreen(` Calculated Severity: ${originalHPMark} HP`);
    
    if (target.type === 'player' && target.current_armor_slots > 0 && hpToMark > 0 && !isDirectDamage) {
        target.current_armor_slots--;
        hpToMark--;
        logToScreen(` ${target.name} marks 1 Armor Slot! (Slots left: ${target.current_armor_slots})`);
    } else if (isDirectDamage && target.type === 'player') {
        logToScreen(` This is DIRECT damage and cannot be mitigated by armor!`);
    }

    target.current_hp -= hpToMark;
    
    if (originalHPMark > hpToMark) {
        logToScreen(` Final HP marked: ${hpToMark}.`);
    } else if (originalHPMark > 0) {
        logToScreen(` Final HP marked: ${hpToMark}.`);
    }
    
    logToScreen(` ${target.name} HP: ${target.current_hp} / ${target.max_hp}`);
    
    if (target.current_hp <= 0) {
        logToScreen(` *** ${target.name} has been defeated! ***`);
    }
}

// --- CORE DICE & PARSING UTILITIES ---
function rollD20() { return Math.floor(Math.random() * 20) + 1; }
function rollD12() { return Math.floor(Math.random() * 12) + 1; }

function executeReactionRoll(target, trait, difficulty) {
    const roll = rollD20();
    const traitMod = target.traits[trait.toLowerCase()] || 0;
    const total = roll + traitMod;
    logToScreen(` ${target.name} makes a ${trait.toUpperCase()} Reaction Roll (Diff ${difficulty})`);
    logToScreen(` Roll: 1d20(${roll}) + ${trait}(${traitMod}) = ${total}`);
    return total >= difficulty;
}

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
    totalDamage += critBonus; 
    
    return totalDamage;
}

function parseDiceString(damageString = "1d4") {
    if (typeof damageString !== 'string') {
        logToScreen(`(ERROR: Invalid damage string: ${damageString})`);
        return { numDice: 0, dieType: 0, modifier: 0, maxDie: 0 };
    }
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

// --- MOVEMENT & RANGE HELPER FUNCTIONS ---

/**
 * NEW: Helper function to check if a cell is occupied.
 * @param {number} x - The x-coordinate to check.
 * @param {number} y - The y-coordinate to check.
 * @param {object} gameState - The entire game state.
 * @param {string} selfId - The ID of the agent moving, to avoid self-collision.
 * @returns {boolean} True if the cell is occupied by another living agent.
 */
function isCellOccupied(x, y, gameState, selfId) {
    const allAgents = [...gameState.players, ...gameState.adversaries];
    for (const agent of allAgents) {
        if (agent.id === selfId || agent.current_hp <= 0) {
            continue; // Skip self and defeated agents
        }
        if (agent.position.x === x && agent.position.y === y) {
            return true; // Cell is occupied
        }
    }
    return false; // Cell is free
}

function getAgentDistance(agentA, agentB) {
    if (!agentA.position || !agentB.position) return 0;
    const dx = Math.abs(agentA.position.x - agentB.position.x);
    const dy = Math.abs(agentA.position.y - agentB.position.y);
    return dx + dy;
}

function isTargetInRange(attacker, target, weaponRangeName) {
    const distance = getAgentDistance(attacker, target);
    const range = (weaponRangeName || 'Melee').trim().toLowerCase();

    switch (range) {
        case 'self':
            return true;
        case 'melee':
            return distance <= CURRENT_BATTLEFIELD.RANGE_MELEE; // 1
        case 'very close':
            return distance <= CURRENT_BATTLEFIELD.RANGE_VERY_CLOSE; // 3
        case 'close':
            return distance <= CURRENT_BATTLEFIELD.RANGE_CLOSE; // 6
        case 'far':
            return distance <= CURRENT_BATTLEFIELD.RANGE_FAR; // 12
        default:
            logToScreen(`(Warning: Unknown range name '${weaponRangeName}')`);
            return false;
    }
}

/**
 * --- *** NEW: Rewritten moveAgentTowards to handle collisions *** ---
 * Moves an agent towards a target one square at a time, up to their speed.
 * @param {object} agent - The agent to move (will be modified).
 * @param {object} target - The agent to move towards.
 * @param {object} gameState - The entire game state, for collision checking.
 */
function moveAgentTowards(agent, target, gameState) {
    let budget = agent.speed; // e.g., 6 squares
    let currentX = agent.position.x;
    let currentY = agent.position.y;
    let originalX = agent.position.x;
    let originalY = agent.position.y;

    while (budget > 0) {
        let movedThisStep = false;
        const dx = target.position.x - currentX;
        const dy = target.position.y - currentY;

        // Stop if we've reached the target
        if (dx === 0 && dy === 0) break;

        // Prioritize moving along the axis with the greater distance
        if (Math.abs(dx) > Math.abs(dy)) {
            let nextX = currentX + Math.sign(dx);
            if (!isCellOccupied(nextX, currentY, gameState, agent.id)) {
                currentX = nextX;
                movedThisStep = true;
            }
        } else {
            let nextY = currentY + Math.sign(dy);
            if (!isCellOccupied(currentX, nextY, gameState, agent.id)) {
                currentY = nextY;
                movedThisStep = true;
            }
        }

        // If the preferred direction was blocked, try the other direction
        if (!movedThisStep) {
            if (Math.abs(dx) > Math.abs(dy)) { // Preferred X was blocked, try Y
                let nextY = currentY + Math.sign(dy);
                if (dy !== 0 && !isCellOccupied(currentX, nextY, gameState, agent.id)) {
                    currentY = nextY;
                    movedThisStep = true;
                }
            } else { // Preferred Y was blocked, try X
                let nextX = currentX + Math.sign(dx);
                if (dx !== 0 && !isCellOccupied(nextX, currentY, gameState, agent.id)) {
                    currentX = nextX;
                    movedThisStep = true;
                }
            }
        }

        // If we're blocked in both directions, we're stuck
        if (!movedThisStep) {
            logToScreen(` -> ${agent.name} is blocked and cannot move further.`);
            break;
        }

        budget--;
    }

    // Only update and log if the position has actually changed
    if (agent.position.x !== currentX || agent.position.y !== currentY) {
        agent.position.x = currentX;
        agent.position.y = currentY;
        logToScreen(` -> ${agent.name} moves to (${currentX}, ${currentY})`);
    }
}
// --- END OF HELPER FUNCTIONS ---


function logToScreen(message) {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.textContent += message + '\n';
        logOutput.scrollTop = logOutput.scrollHeight; 
    }
}

// --- *** NEW: VISUALIZER RENDER FUNCTION *** ---
function renderBattlemap(gameState) {
    const map = document.getElementById('battlemap-grid');
    if (!map) return; 
    
    map.innerHTML = ''; // Clear the map

    // --- NEW: Render the grid cells ---
    const totalCells = CURRENT_BATTLEFIELD.MAX_X * CURRENT_BATTLEFIELD.MAX_Y;
    let gridHtml = '';
    for (let i = 0; i < totalCells; i++) {
        gridHtml += '<div class="empty-cell"></div>';
    }
    map.innerHTML = gridHtml;
    // --- END NEW ---

    // Render players
    for (const player of gameState.players) {
        if (player.current_hp <= 0) continue; 
        
        const token = document.createElement('div');
        token.className = 'token player-token';
        token.title = `${player.name} (HP: ${player.current_hp})`;
        
        token.style.gridColumn = player.position.x;
        token.style.gridRow = player.position.y;
        
        map.appendChild(token);
    }

    // Render adversaries
    for (const adv of gameState.adversaries) {
        if (adv.current_hp <= 0) continue; 
        
        const token = document.createElement('div');
        token.className = 'token adversary-token';
        token.title = `${adv.name} (HP: ${adv.current_hp})`;
        
        token.style.gridColumn = adv.position.x;
        token.style.gridRow = adv.position.y;
        
        map.appendChild(token);
    }
}