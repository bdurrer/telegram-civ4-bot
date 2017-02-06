/*

 Name: Civ 4 Bot Module
 Description: Observes a status website and sends push notifications when the status changes.

 */


const fs = require('fs'),
      http = require('http'),
      cheerio = require('cheerio');

// Store users
let state = {};
/*
const commands = [
    ['/start', 'Aktiviert den Bot'],
    ['/stop', 'Deaktiviert den Bot'],
    ['/status', 'Zeigt den aktuellen Spielstand an'],
    ['/settings', 'Deine persönlichen Einstellungen'],
    ['/setenemies', 'Aktualisiere die Liste deiner Feinde']
];
*/

let gameState = {
    round: 0,
    players: [
        /* {id: 0, name: 'Anubis', ready: false} */
    ]
};

// Export bot module
module.exports = (bot, cfg) => {

    const defaultOpts = {
        statusPageUrl: 'http://localhost:8080/index.html',
        updateInterval: 15 * 60, // in seconds
        botStateSaveFileName: 'bot-state.json',
        msg: {
            startStepWelcome: '*Hallo Möchtegernherrscher!*\nDu hast den Weg zu mir gefunden. Gut, gut.' +
                              '\n\nDann nenne mir doch die Civilisation aus der Liste unten, welche du regierst.\n',
            startStepEnemies: 'Wähle nun die Feinde, welche *vor dir ziehen*. Dann werde ich dich erst benachrichtigen, wenn diese ihren Zug abgeschlossen haben.',
            startWrongCiv: 'Antworte mit der *Nummer* vor Civilisation in der Liste oben.',
            notificationsEnabledNow: 'Ich werde dich von nun an Benachrichtigen, sobald eine neue Runde beginnt.' +
                                     '\n\nFalls dir das zuviel wird, sag /stop zu mir.' +
                                     '\nDu kannst deine Liste von Feinden jederzeit neu setzen mit /setenemies',
            notificationsEnabledNowWithEnemies: 'Ich werde dich von nun an Benachrichtigen, sobald deine Feinde in einer neuen Runde alle gezogen haben.' +
                                    '\n\nFalls dir das zuviel wird, sag /stop zu mir.' +
                                    '\nDu kannst deine Liste von Feinden jederzeit neu setzen mit /setenemies',
            noEnemyResponse: 'Keine',
            noMoreEnemiesResponse: 'Nein',
            noMoreEnemiesConfirm: 'Gut! Du wirs ab sofort erst eine Benachrichtigung erhalten, wenn die genannten Feinde ihren Zug abgeschlossen haben.',
            youHaveMorEnemies: 'Hast du noch weitere Feinde, welche vor dir ziehen müssen?'
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


    function getStatusForPlayer(playerNr) {
      return gameState.players[playerNr];
    }
    function getStatusForUserId(id) {
      let userObj = state.users[id];
      if (userObj){
        return gameState.players[userObj.civ];
      } else {
        console.log(`access error on getStatusForUserId(${id}) - no such user`);
        return {};
      }
    }

    /**
     * fetches the game state from the website and triggers an update, if anything changed
     */
    function updateGameState(enableNotification){
      return http.get(opt.statusPageUrl, (res) => {
        const statusCode = res.statusCode;
        if (statusCode !== 200) {
          console.log(`Status update from ${opt.statusPageUrl} failed with response code ${statusCode}. Next try in ${opt.updateInterval} seconds.`);
          res.resume();
          return;
        }

        // Continuously update stream with data
        let body = '';
        res.on('data', (d) => {
            body += d;
        });
        res.on('end', () => {
            onGameStateChanged(body, enableNotification);
        });
      });
    }

    function onGameStateChanged(responseHtml, enableNotification){
      try {
        // have fun parsing that
        let $ = cheerio.load(responseHtml);
        let gameHasChanged = false;

        // extract the value from text: "<li>nextRound: ??</li>"
        let roundValue = $('#gamestatus li');
        roundValue = $(roundValue[2]).text().split(':')[1];

        let currentRound = parseInt(roundValue, 10);
        if (currentRound !== gameState.round) {
          gameHasChanged = true;
          gameState.round = currentRound;
        }

        let players = [];
        $('#playerinfo tbody tr').each((i, tr) => {
          let children = $(tr).children();
          let playerNumber = i; // $(children[0]).text().replace('P','');
          let player = {
            id: parseInt(playerNumber, 10),
            ready: ($(children[1]).text() === '*'),
            name: $(children[2]).text(),
            status: $(children[3]).text(),
            score: $(children[4]).text()
          };
          players.push(player);
        });
        gameState.players = players;

        if (gameHasChanged && enableNotification) {
          console.log(`New round ${currentRound} has started!`);
          notifyNewRound();
        } else {
          console.log('Updated game state from status page.');
        }
      } catch (e) {
        console.error('Oops, an error occured when parsing the game state from the remote website!', e);
      }
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
            updateGameState(false);
            // update the game state every X seconds
            intervalHandle = setInterval(updateGameState, opt.updateInterval * 1000, true);
        }
    }

    function needsNotification(user){
      if (user.lastNotifiedRound === gameState.round) {
        return false;
      }

      let allEnemiesReady = true;
      for (let civNr in user.enemyCivs) {
        if (!gameState.players[civNr] || !gameState.players[civNr].ready) {
          // the enemy player is ready
          allEnemiesReady = false;
          break;
        }
      }
      return allEnemiesReady;
    }

    function notifyNewRound() {
        for (let key in state.users) {
            let user = state.users[key];
            if (needsNotification(user)){
              bot.sendMessage(user.id, `${getStatusForPlayer(user.civ).name}, es ist Zeit um deinen Zug in Runde ${gameState.round} zu machen!\nInfos: /status`);
            }
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

        // build the list of available civs
        for (let i=0; i < gameState.players.length; i++) {
            buttons.push('' + (i+1));
            text += `\n${i+1}. ${getStatusForPlayer(i).name}`;
            if (buttons.length > 0 && buttons.length % 5 === 0) {
                keyBoardRows.push(buttons);
                buttons = [];
            }
        }
        if (buttons.length > 0) {
            keyBoardRows.push(buttons);
        }
        markup = bot.keyboard(keyBoardRows, {resize: true});
        // Ask for the user's civilisation
        return bot.sendMessage(id, text, {markup, ask: 'civ', parse: 'markdown'});
    });

    // Callback for when we ask for the user's civilisation
    bot.on('ask.civ', (msg) => {
        const id = msg.from.id;
        const respNr = parseInt(msg.text, 10) - 1; // index in our player list
        console.log('the user responded with an enemy number which is', respNr);

        if (respNr >= 0 && respNr < gameState.players.length && gameState.players[respNr]) {
            // valid selection - save player's civ and ask for enemies
            state.users = state.users || {};
            state.users[id] = {
                civ: respNr,
                id,
                enemyCivs: []
            };
            saveData();
            return onStartUpdateEnemies(msg);
            //return bot.sendMessage(id, `Nun dann, *${ gameState.players[respNr].name }*!`, {markup: 'hide', parse: 'markdown'});
        } else {
            return bot.sendMessage(id, opt.msg.startWrongCiv, {ask: 'civ'});
        }
    });

    function onStartUpdateEnemies(msg) {
      const id = msg.from.id;
      let text = `Sehr schön, ${getStatusForUserId(id).name}.\n${opt.msg.startStepEnemies}`;
      let markup,
          buttons = [],
          keyBoardRows = [];

      // build the list of available civs
      for (let i=0; i < gameState.players.length; i++) {
        if (state.users[id].civ !== i) {
          // only list other players, not the current user
          buttons.push('' + (i+1));
          text += `\n${i+1}. ${gameState.players[i].name}`;
        }
        if (buttons.length > 0 && buttons.length % 5 === 0) {
            keyBoardRows.push(buttons);
            buttons = [];
        }
      }
      if (buttons.length > 0) {
          keyBoardRows.push(buttons);
      }
      keyBoardRows.push([opt.msg.noEnemyResponse]);
      markup = bot.keyboard(keyBoardRows, {resize: true});
      // Ask for the user's civilisation
      return bot.sendMessage(id, text, {markup, ask: 'enemies', parse: 'markdown'});
    }
    bot.on(['/setenemies'], onStartUpdateEnemies);

    // Callback for when we ask for the user's enemies
    bot.on('ask.enemies', (msg) => {
      const id = msg.from.id;
      const respNr = parseInt(msg.text, 10) - 1; // index in our player list
      console.log(`user ${id} chose ${respNr} as enemy`);

      if (msg.text === opt.msg.noMoreEnemiesResponse || msg.text === opt.msg.noEnemyResponse) {
        // the user has listed all enemies
        if (state.users[id].enemyCivs && state.users[id].enemyCivs.length > 0) {
           return bot.sendMessage(id, opt.msg.notificationsEnabledNowWithEnemies, {markup: 'hide', parse: 'markdown'});
        } else {
          return bot.sendMessage(id, opt.msg.notificationsEnabledNow, {markup: 'hide', parse: 'markdown'});
        }

      } else if (respNr >= 0 && respNr < gameState.players.length && gameState.players[respNr]) {
        // add the enemy to the list
        state.users[id].enemyCivs = state.users[id].enemyCivs || [];
        state.users[id].enemyCivs.push(respNr);

        let markup,
            buttons = [],
            keyBoardRows = [];

        // ask for more civs, but add an NO button
        for (let i=0; i < gameState.players.length; i++) {
          if (state.users[id].civ !== i) {
            // only list other players, not the current user
            buttons.push('' + (i+1));
          }
          if (buttons.length > 0 && buttons.length % 5 === 0) {
              keyBoardRows.push(buttons);
              buttons = [];
          }
        }
        if (buttons.length > 0) {
            keyBoardRows.push(buttons);
        }
        keyBoardRows.push([opt.msg.noMoreEnemiesResponse]);
        markup = bot.keyboard(keyBoardRows, {resize: true});
        return bot.sendMessage(id, `${getStatusForPlayer(respNr).name}, ok. ${opt.msg.youHaveMorEnemies}`, {markup, ask: 'enemies'});

      } else {
        // this is an invalid response
        return bot.sendMessage(id, opt.msg.startWrongCiv, {ask: 'enemies'});
      }
    });

    // force update
    bot.on('/update', () => {
        notifyNewRound();
        return true;
    });
};
