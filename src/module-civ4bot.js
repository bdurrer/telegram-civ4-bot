/*

 Name: Civ 4 Bot Module
 Description: Observes a status website and sends push notifications when the status changes.

 */


const fs = require('fs');

// Store users
let state = {};
/*
const commands = [
    ['/start', 'Aktiviert den Bot'],
    ['/stop', 'Deaktiviert den Bot'],
    ['/status', 'Zeigt den aktuellen Spielstand an'],
    ['/settings', 'Deine persönlichen Einstellungen']
];
*/

let gameState = {
    round: 12,
    players: [
        {id: 1, name: 'Hans', status: 'ready'},
        {id: 2, name: 'Reinhart', status: 'open'},
        {id: 3, name: 'Ben', status: 'open'},
        {id: 4, name: 'Darmbart', status: 'open'},
        {id: 5, name: 'Johann', status: 'open'},
        {id: 6, name: 'Marks', status: 'open'},
        {id: 7, name: 'Dölfu', status: 'open'},
        {id: 8, name: 'Stahlkopf der Schreckliche', status: 'open'},
        {id: 9, name: 'Baumarm Doppelberg', status: 'open'},
        {id: 10, name: 'SuperR0xxor', status: 'open'},
        {id: 11, name: 'Jenny', status: 'open'},
        {id: 12, name: 'Rickroll', status: 'open'},
        {id: 13, name: 'Gwünner', status: 'open'},
        {id: 14, name: 'Sieger', status: 'open'}
    ]
};

// Export bot module
module.exports = (bot, cfg) => {

    const defaultOpts = {
        statusPageUrl: 'http://localhost:8080/index.html',
        botStateSaveFileName: 'bot-state.json',
        msg: {
            startStepWelcome: '*Hallo Möchtegernherrscher!*\nDu hast den Weg zu mir gefunden. Gut, gut.' +
                              '\n\nDann nenne mir doch die Civilisation aus der Liste unten, welche du regierst.\n',
            startWrongCiv: 'Bonasera, Bonasera, was habe ich dir getan, dass du mich so respektlos behandelst. ' +
                           'Du kommst in mein Haus am Hochzeitstag meiner Tochter und bittest mich einen Mord zu begehen.' +
                           '\n\nWähle bitte eine Civilisation aus der Liste oben aus.',
            notificationsEnabledNow: 'Ich werde dich von nun an Benachrichtigen, sobald eine neue Runde beginnt.' +
                                     '\n\nFalls dir das zuviel wird, sag /stop zu mir.',
        }
    };

    let opt = Object.assign({}, defaultOpts, cfg.civ4bot);
    let intervalHandle = null;

    // Load config data
    try {
        state = JSON.parse(fs.readFileSync(opt.botStateSaveFileName));
    } catch (e) {
        console.log('there is no bot-state file yet, creating it now');
        fs.writeFileSync(opt.botStateSaveFileName, '{}');
    }

    function saveData() {
        console.log('saving game state to disk');
        fs.writeFileSync(opt.botStateSaveFileName, JSON.stringify(state));
    }

    function shutdown() {
        if (intervalHandle) {
            clearInterval(intervalHandle);
        }
        intervalHandle = null;
        saveData();
        console.log('shutting down');
    }
    function startup() {
        if (!intervalHandle) {
            // save the state every 15 minutes
            intervalHandle = setInterval(saveData, 1000 * 60 * 15);
        }
    }

    function notifyNewRound() {
        for (let i in state.users) {
            let user = state.users[i];
            console.log(`notifying user ${user.id} with civ ${user.civ} about the new round`);
            bot.sendMessage(user.id, `Hey ${gameState.players[user.civ].name}, round ${gameState.round} has started!`);
        }
    }

    bot.on('connect', startup);
    bot.on('disconnect', shutdown);

    bot.on(['/start'], (msg) => {
        const id = msg.from.id;
        let buttons = ['/start'],
        text = opt.msg.startStepWelcome;
        let markup;
        let keyBoardRows = [];

        for (let i=0; i < gameState.players.length; i++) {
            buttons.push('' + (i+1));
            text += `\n${i+1}. ${gameState.players[i].name}`;
            if (i > 0 && i % 5 === 0) {
                keyBoardRows.push(buttons);
                buttons = [];
            }
        }
        if (buttons.length > 0) {
            keyBoardRows.push(buttons);
        }
        markup = bot.keyboard(keyBoardRows, {resize: false});
        // Ask for the user's civ
        return bot.sendMessage(id, text, {markup, ask: 'civ', parse: 'markdown'});
    });

    // Ask name event
    bot.on('ask.civ', (msg) => {
        const id = msg.from.id;
        const number = parseInt(msg.text, 10) - 1;
        console.log('the user responded with his user number which is ', number);

        if (number >= 0 && number < gameState.players.length && gameState.players[number]) {

            state.users = state.users || {};
            state.users[msg.from.id] = {
                civ: number,
                id: msg.from.id
            };
            saveData();

            return bot.sendMessage(id, `Nun dann, *${ gameState.players[number].name }*!` + opt.msg.notificationsEnabledNow, {markup: 'hide', parse: 'markdown'});
        } else {
            return bot.sendMessage(id, opt.msg.startWrongCiv, {ask: 'civ'});
        }
    });

    // Buttons
    bot.on('/update', () => {
        notifyNewRound();
        return true;
    });

/*
    // Buttons
    bot.on('/buttons', (msg) => {
        let markup = bot.keyboard([[], ['1', '2', '3']], {resize: true});
        return bot.sendMessage(msg.from.id, 'Button example.', {markup});
    });

    bot.on('/hide', (msg) => {
        return bot.sendMessage(msg.from.id, 'Ok, hiding buttons', {markup: 'hide'});
    })

    bot.on(['/banana'], (msg) => {
        let id = msg.from.id;
        let [cmdName, userName] = msg.text.split(' ');
        console.log('/start was triggered from ', username, ', it said ', msg.text);
        if (userName) {
            return bot.sendMessage(msg.from.id, `Ok thanks ${userName}`);
        } else {
            return bot.sendMessage(msg.from.id, `Please give me your ingame name`);
        }
    });
*/
};
