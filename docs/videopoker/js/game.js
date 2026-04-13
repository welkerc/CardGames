const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const STORAGE_CREDITS = 'videopoker_credits';
const STORAGE_STATS = 'videopoker_stats';
const STORAGE_VARIANT = 'videopoker_variant';

const PAYOUTS_JACKS = {
    'royal-flush': { name: 'Royal Flush', base: 250, max: 800 },
    'straight-flush': { name: 'Straight Flush', base: 50 },
    'four-kind': { name: 'Four of a Kind', base: 25 },
    'full-house': { name: 'Full House', base: 9 },
    'flush': { name: 'Flush', base: 6 },
    'straight': { name: 'Straight', base: 4 },
    'three-kind': { name: 'Three of a Kind', base: 3 },
    'two-pair': { name: 'Two Pair', base: 2 },
    'jacks-better': { name: 'Jacks or Better', base: 1 }
};

const PAYOUTS_DEUCES = {
    'royal-flush': { name: 'Natural Royal Flush', base: 800 },
    'four-deuces': { name: 'Four Deuces', base: 200 },
    'wild-royal': { name: 'Wild Royal Flush', base: 25 },
    'five-kind': { name: 'Five of a Kind', base: 15 },
    'straight-flush': { name: 'Straight Flush', base: 9 },
    'four-kind': { name: 'Four of a Kind', base: 5 },
    'full-house': { name: 'Full House', base: 3 },
    'flush': { name: 'Flush', base: 2 },
    'straight': { name: 'Straight', base: 2 },
    'three-kind': { name: 'Three of a Kind', base: 1 }
};

let gameState = {
    variant: 'jacks',
    phase: 'betting',
    credits: 100,
    bet: 0,
    deck: [],
    hand: [],
    held: [false, false, false, false, false],
    stats: {
        handsPlayed: 0,
        wins: 0,
        bestHand: '-',
        netProfit: 0
    }
};

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, value: RANK_VALUES[rank] });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getPayoutTable(variant) {
    return variant === 'jacks' ? PAYOUTS_JACKS : PAYOUTS_DEUCES;
}

function isWild(card) {
    return gameState.variant === 'deuces' && card.rank === '2';
}

function evaluateHand(hand, variant) {
    const sortedHand = [...hand].sort((a, b) => {
        if (isWild(a) && !isWild(b)) return 1;
        if (!isWild(a) && isWild(b)) return -1;
        return a.value - b.value;
    });

    const isDeuces = variant === 'deuces';
    const wildCount = isDeuces ? hand.filter(c => c.rank === '2').length : 0;
    const nonWildCards = sortedHand.filter(c => !isWild(c));
    const nonWildSorted = nonWildCards.sort((a, b) => a.value - b.value);

    const suits = nonWildCards.map(c => c.suit);
    const isFlush = nonWildCards.length >= 5 && 
        nonWildCards.every(c => c.suit === suits[0]);

    let minVal = nonWildCards.length > 0 ? Math.min(...nonWildCards.map(c => c.value)) : 0;
    
    let isStraight = false;
    if (nonWildSorted.length >= 5) {
        const values = nonWildSorted.map(c => c.value);
        const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
        
        if (uniqueValues.length >= 5) {
            for (let i = 0; i <= uniqueValues.length - 5; i++) {
                const segment = uniqueValues.slice(i, i + 5);
                if (segment[4] - segment[0] === 4) {
                    isStraight = true;
                    break;
                }
            }
        }
    }

    const aceLowStraight = isDeuces && wildCount >= 1 && 
        nonWildCards.some(c => c.rank === 'A') &&
        nonWildCards.some(c => c.value === 2) &&
        nonWildCards.some(c => c.value === 3) &&
        nonWildCards.some(c => c.value === 4) &&
        nonWildCards.some(c => c.value === 5);

    if (aceLowStraight) isStraight = true;

    const valueCounts = {};
    for (const card of nonWildCards) {
        valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    }
    const counts = Object.values(valueCounts).sort((a, b) => b - a);

    if (isDeuces) {
        if (isFlush && isStraight && wildCount === 0) {
            const hasAce = nonWildCards.some(c => c.rank === 'A');
            const hasTen = nonWildCards.some(c => c.rank === '10');
            const hasJack = nonWildCards.some(c => c.rank === 'J');
            const hasQueen = nonWildCards.some(c => c.rank === 'Q');
            const hasKing = nonWildCards.some(c => c.rank === 'K');
            if (hasAce && hasTen && hasJack && hasQueen && hasKing) {
                return { name: 'royal-flush', display: 'Natural Royal Flush', isNatural: true };
            }
            return { name: 'straight-flush', display: 'Straight Flush', isNatural: false };
        }
        if (isFlush && isStraight) {
            return { name: 'wild-royal', display: 'Wild Royal Flush', isNatural: false };
        }
        if (wildCount === 4) return { name: 'four-deuces', display: 'Four Deuces', isNatural: false };
        if (wildCount === 3 && nonWildSorted.length === 2) return { name: 'four-kind', display: 'Four of a Kind', isNatural: false };
        if (wildCount === 2 && nonWildSorted.length === 3) return { name: 'four-kind', display: 'Four of a Kind', isNatural: false };
        if (wildCount === 1 && nonWildSorted.length === 4) return { name: 'four-kind', display: 'Four of a Kind', isNatural: false };
        if (isFlush) return { name: 'flush', display: 'Flush', isNatural: false };
        if (isStraight) return { name: 'straight', display: 'Straight', isNatural: false };
        if (counts[0] === 2 && counts[1] === 2) return { name: 'full-house', display: 'Full House', isNatural: false };
        if (nonWildSorted.length >= 5 && isFlush) return { name: 'flush', display: 'Flush', isNatural: false };
        if (nonWildSorted.length >= 5 && isStraight) return { name: 'wild-royal', display: 'Wild Royal Flush', isNatural: false };
        if (nonWildSorted.length === 5) return { name: 'five-kind', display: 'Five of a Kind', isNatural: false };
        if (wildCount === 2 && nonWildSorted.length === 1) return { name: 'four-kind', display: 'Four of a Kind', isNatural: false };
        if (wildCount === 1 && nonWildSorted.length <= 2) return { name: 'three-kind', display: 'Three of a Kind', isNatural: false };
        if (counts[0] === 3) return { name: 'four-kind', display: 'Four of a Kind', isNatural: false };
        if (counts[0] === 2) return { name: 'three-kind', display: 'Three of a Kind', isNatural: false };
        if (counts[0] === 1) return { name: 'three-kind', display: 'Three of a Kind', isNatural: false };
    } else {
        if (isFlush && isStraight && minVal === 10) {
            return { name: 'royal-flush', display: 'Royal Flush', isNatural: true };
        }
        if (isFlush && isStraight) return { name: 'straight-flush', display: 'Straight Flush', isNatural: true };
        if (counts[0] === 4) return { name: 'four-kind', display: 'Four of a Kind', isNatural: true };
        if (counts[0] === 3 && counts[1] === 2) return { name: 'full-house', display: 'Full House', isNatural: true };
        if (isFlush) return { name: 'flush', display: 'Flush', isNatural: true };
        if (isStraight) return { name: 'straight', display: 'Straight', isNatural: true };
        if (counts[0] === 3) return { name: 'three-kind', display: 'Three of a Kind', isNatural: true };
        if (counts[0] === 2 && counts[1] === 2) return { name: 'two-pair', display: 'Two Pair', isNatural: true };
        if (counts[0] === 2) {
            const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
            if (pairValue >= 11) return { name: 'jacks-better', display: 'Jacks or Better', isNatural: true };
        }
    }

    return { name: null, display: 'No Win', isNatural: false };
}

function calculatePayout(handResult, bet) {
    if (!handResult.name) return 0;
    const payouts = getPayoutTable(gameState.variant);
    const payoutInfo = payouts[handResult.name];
    if (!payoutInfo) return 0;
    
    let multiplier = payoutInfo.base;
    if (handResult.name === 'royal-flush' && bet === 5) {
        multiplier = payoutInfo.max;
    }
    return bet * multiplier;
}

function loadCredits() {
    const saved = localStorage.getItem(STORAGE_CREDITS);
    return saved ? parseInt(saved, 10) : 100;
}

function saveCredits() {
    localStorage.setItem(STORAGE_CREDITS, gameState.credits.toString());
}

function loadStats() {
    const saved = localStorage.getItem(STORAGE_STATS);
    if (saved) {
        gameState.stats = JSON.parse(saved);
    }
}

function saveStats() {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(gameState.stats));
}

function loadVariant() {
    const saved = localStorage.getItem(STORAGE_VARIANT);
    return saved || 'jacks';
}

function saveVariant() {
    localStorage.setItem(STORAGE_VARIANT, gameState.variant);
}

function createCardElement(card, index, isWildCard, animate = false) {
    const isRed = card.suit === '♥' || card.suit === '♦';
    const colorClass = isRed ? 'red' : 'black';
    const wildClass = isWildCard ? 'wild' : '';
    const heldClass = gameState.held[index] ? 'held' : '';
    const animClass = animate ? 'animate-deal' : '';
    
    return `
        <div class="card ${colorClass} ${wildClass} ${heldClass} ${animClass}" data-index="${index}">
            <div class="rank">${card.rank}</div>
            <div class="suit">${card.suit}</div>
            <div class="rank-bottom">${card.rank}</div>
            <div class="hold-label">HOLD</div>
        </div>
    `;
}

function renderCards(animate = false) {
    const cardArea = document.getElementById('card-area');
    
    if (gameState.hand.length === 0) {
        cardArea.innerHTML = '';
        return;
    }
    
    let html = '';
    gameState.hand.forEach((card, i) => {
        html += createCardElement(card, i, isWild(card), animate);
    });
    cardArea.innerHTML = html;
    
    if (gameState.phase === 'hold') {
        document.querySelectorAll('.card').forEach(cardEl => {
            cardEl.addEventListener('click', () => {
                const idx = parseInt(cardEl.dataset.index);
                toggleHold(idx);
            });
        });
    }
}

function renderPayoutTable() {
    const payouts = getPayoutTable(gameState.variant);
    const container = document.getElementById('payout-content');
    
    let html = '';
    for (const key in payouts) {
        const p = payouts[key];
        const maxText = p.max ? ` / ${p.max}` : '';
        html += `
            <div class="payout-row">
                <span class="payout-hand">${p.name}</span>
                <span class="payout-value">${p.base}${maxText}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

function updateUI(animate = false) {
    document.getElementById('credits').textContent = gameState.credits;
    document.getElementById('current-bet').textContent = gameState.bet;
    
    document.getElementById('stat-hands').textContent = gameState.stats.handsPlayed;
    document.getElementById('stat-wins').textContent = gameState.stats.wins;
    document.getElementById('stat-best').textContent = gameState.stats.bestHand;
    document.getElementById('stat-profit').textContent = (gameState.stats.netProfit >= 0 ? '+' : '') + gameState.stats.netProfit;
    
    document.querySelectorAll('.variant-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.variant === gameState.variant);
    });
    
    const dealBtn = document.getElementById('btn-deal');
    const drawBtn = document.getElementById('btn-draw');
    const betBtns = document.querySelectorAll('.bet-controls .btn');
    
    if (gameState.phase === 'betting') {
        dealBtn.classList.remove('hidden');
        drawBtn.classList.add('hidden');
        betBtns.forEach(btn => btn.disabled = false);
    } else if (gameState.phase === 'hold') {
        dealBtn.classList.add('hidden');
        drawBtn.classList.remove('hidden');
        betBtns.forEach(btn => btn.disabled = true);
    } else if (gameState.phase === 'result') {
        dealBtn.classList.remove('hidden');
        drawBtn.classList.add('hidden');
        betBtns.forEach(btn => btn.disabled = false);
    }
    
    renderCards(animate);
    renderPayoutTable();
}

function setMessage(text, isWin = false) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.classList.toggle('win', isWin);
}

function showWin(amount) {
    const winDisplay = document.getElementById('win-display');
    winDisplay.textContent = `+${amount}`;
    winDisplay.classList.add('visible');
    setTimeout(() => {
        winDisplay.classList.remove('visible');
    }, 2000);
}

function deal() {
    if (gameState.bet === 0) {
        setMessage('Place a bet first!');
        return;
    }
    
    gameState.credits -= gameState.bet;
    gameState.stats.netProfit -= gameState.bet;
    saveCredits();
    
    gameState.deck = shuffleDeck(createDeck());
    gameState.hand = gameState.deck.splice(0, 5);
    gameState.held = [false, false, false, false, false];
    gameState.phase = 'hold';
    
    setMessage('Select cards to hold, then press Draw');
    updateUI(true);
}

function draw() {
    for (let i = 0; i < 5; i++) {
        if (!gameState.held[i]) {
            gameState.hand[i] = gameState.deck.pop();
        }
    }
    
    const result = evaluateHand(gameState.hand, gameState.variant);
    const payout = calculatePayout(result, gameState.bet);
    
    gameState.stats.handsPlayed++;
    
    if (payout > 0) {
        gameState.credits += payout;
        gameState.stats.netProfit += payout;
        gameState.stats.wins++;
        
        if (gameState.stats.bestHand === '-' || 
            (gameState.variant === 'jacks' && getHandRank(result.name) > getHandRank(getHandName(gameState.stats.bestHand))) ||
            (gameState.variant === 'deuces' && getHandRankDeuces(result.name) > getHandRankDeuces(getHandName(gameState.stats.bestHand)))) {
            gameState.stats.bestHand = result.display;
        }
        
        saveCredits();
        saveStats();
        
        const royalText = result.name === 'royal-flush' ? ' - ROYAL FLUSH!' : '';
        setMessage(`${result.display}${royalText} - Won ${payout} credits!`, true);
        showWin(payout);
    } else {
        setMessage(`${result.display} - No win this hand`);
    }
    
    gameState.phase = 'result';
    gameState.bet = 0;
    updateUI(true);
}

function getHandRank(handName) {
    const ranks = {
        'royal-flush': 9,
        'straight-flush': 8,
        'four-kind': 7,
        'full-house': 6,
        'flush': 5,
        'straight': 4,
        'three-kind': 3,
        'two-pair': 2,
        'jacks-better': 1,
        'five-kind': 10,
        'wild-royal': 8,
        'four-deuces': 9
    };
    return ranks[handName] || 0;
}

function getHandRankDeuces(handName) {
    const ranks = {
        'royal-flush': 10,
        'four-deuces': 9,
        'wild-royal': 8,
        'five-kind': 7,
        'straight-flush': 6,
        'four-kind': 5,
        'full-house': 4,
        'flush': 3,
        'straight': 2,
        'three-kind': 1
    };
    return ranks[handName] || 0;
}

function getHandName(display) {
    const names = {
        'Royal Flush': 'royal-flush',
        'Natural Royal Flush': 'royal-flush',
        'Straight Flush': 'straight-flush',
        'Four of a Kind': 'four-kind',
        'Full House': 'full-house',
        'Flush': 'flush',
        'Straight': 'straight',
        'Three of a Kind': 'three-kind',
        'Two Pair': 'two-pair',
        'Jacks or Better': 'jacks-better',
        'Five of a Kind': 'five-kind',
        'Wild Royal Flush': 'wild-royal',
        'Four Deuces': 'four-deuces'
    };
    return names[display] || 'unknown';
}

function setBet(amount) {
    if (gameState.phase !== 'betting' && gameState.phase !== 'result') return;
    
    if (amount === 'max') {
        gameState.bet = Math.min(5, gameState.credits);
    } else if (amount === 'half') {
        gameState.bet = Math.floor(gameState.bet / 2);
    } else if (amount === 'double') {
        if (gameState.bet * 2 <= gameState.credits) {
            gameState.bet *= 2;
        }
    } else {
        if (gameState.bet + amount <= gameState.credits) {
            gameState.bet += amount;
        }
    }
    
    updateUI(false);
}

function toggleHold(index) {
    if (gameState.phase !== 'hold') return;
    gameState.held[index] = !gameState.held[index];
    updateUI(false);
}

function setVariant(variant) {
    gameState.variant = variant;
    saveVariant();
    updateUI(false);
}

function showRules() {
    document.getElementById('rules-modal').classList.remove('hidden');
}

function hideRules() {
    document.getElementById('rules-modal').classList.add('hidden');
}

function init() {
    gameState.variant = loadVariant();
    gameState.credits = loadCredits();
    loadStats();
    
    document.getElementById('btn-deal').addEventListener('click', deal);
    document.getElementById('btn-draw').addEventListener('click', draw);
    document.getElementById('bet-one').addEventListener('click', () => setBet(1));
    document.getElementById('bet-max').addEventListener('click', () => setBet('max'));
    document.getElementById('bet-half').addEventListener('click', () => setBet('half'));
    document.getElementById('bet-double').addEventListener('click', () => setBet('double'));
    
    document.querySelectorAll('.variant-btn').forEach(btn => {
        btn.addEventListener('click', () => setVariant(btn.dataset.variant));
    });
    
    document.getElementById('rules-btn').addEventListener('click', showRules);
    document.getElementById('close-rules').addEventListener('click', hideRules);
    document.getElementById('rules-modal').addEventListener('click', (e) => {
        if (e.target.id === 'rules-modal') hideRules();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '5') {
            toggleHold(parseInt(e.key) - 1);
        } else if (e.key === 'd' || e.key === 'D') {
            if (gameState.phase === 'betting' || gameState.phase === 'result') {
                deal();
            } else if (gameState.phase === 'hold') {
                draw();
            }
        } else if (e.key === ' ' || e.key === 'Enter') {
            if (gameState.phase === 'betting') {
                deal();
            } else if (gameState.phase === 'hold') {
                draw();
            }
        } else if (e.key === 'Escape') {
            hideRules();
        }
    });
    
    updateUI(false);
}

document.addEventListener('DOMContentLoaded', init);
