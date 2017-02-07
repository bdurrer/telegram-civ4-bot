/*

 Name: Civ 4 Bot Module
 Description: Observes a status website and sends push notifications when the status changes.

 */


const gameStateModule = require('./gamestate.js');
const botStateModule = require('./botstate.js');

/*
const commands = [
    ['/start', 'Aktiviert den Bot'],
    ['/stop', 'Deaktiviert den Bot'],
    ['/status', 'Zeigt den aktuellen Spielstand an'],
    ['/settings', 'Deine persönlichen Einstellungen'],
    ['/setenemies', 'Aktualisiere die Liste deiner Feinde']
];
*/

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

    const botState = botStateModule(bot, opt);
    const gameState = gameStateModule(bot, opt, botState);

    function startup() {
        if (!intervalHandle) {
          // this might run into issues here if this runs longer than the interval below
          botState.loadData();
          gameState.updateGameState();

          // update the game state every X seconds
          intervalHandle = setInterval(() => {
            gameState.updateGameState().then((hasChanged) => {
              if (hasChanged === true) {
                sendNotifications();
              }
            }).catch(error =>{
              console.log(`Status update from ${opt.statusPageUrl} failed. Next try in ${opt.updateInterval} seconds.`, error);
            });
          }, opt.updateInterval * 1000);
        }
    }
    bot.on('connect', startup);

    function shutdown() {
        if (intervalHandle) {
            clearInterval(intervalHandle);
        }
        intervalHandle = null;
        saveData();
        console.log('shutting down');
    }
    bot.on('disconnect', shutdown);

    /**
     * @description Checks if this user should be notified about the current round or not.
     * @return TRUE if user needs notification, FALSE otherwise
     */
    function needsNotification(user){
      if (user.lastNotifiedRound === gameState.getRound()) {
        return false;
      }

      let allEnemiesReady = true;
      for (let civNr in user.enemyCivs) {
        if (!gameState.getCiv(civNr) || !gameState.getCiv(civNr).ready) {
          // the enemy player is ready
          allEnemiesReady = false;
          break;
        }
      }
      return allEnemiesReady;
    }

    /**
     * @description Sends a message to all user which can play their turn and did not get any message about the current round yet.
     */
    function sendNotifications() {
      const round = gameState.getRound();
      let users = botState.getUsers();
      for (let key in users) {
        if (users.hasOwnProperty(key)) {
          let user = users[key];
          if (needsNotification(user)){
            user.lastNotifiedRound = round;
            bot.sendMessage(user.id, `${gameState.getCiv(user.civ).name}, es ist Zeit um deinen Zug in Runde ${round} zu machen!\nInfos: /status`);
          }
        }
      }
    }

    function buildCivList(civs, abortResponseText) {
      let text = '';
      let markup,
          buttons = [],
          keyBoardRows = [];
      // build the list of available civs
      for (let i=0; i < civs.length; i++) {
        buttons.push('' + (i+1));
        text += `\n${i+1}. ${civs[i].name}`;

        if (buttons.length > 0 && buttons.length % 5 === 0) {
            keyBoardRows.push(buttons);
            buttons = [];
        }
      }
      if (buttons.length > 0) {
          keyBoardRows.push(buttons);
      }
      if (abortResponseText) {
        keyBoardRows.push([abortResponseText]);
      }
      markup = bot.keyboard(keyBoardRows, {resize: true});

      return [
        text,
        markup
      ];
    }

    function fixedLength(text,size) {
      let i,
          result = text + '';
      for (i = result.length; i < size; i++) {
          result += '&#160;';
      }
      return result;
    }

    bot.on(['/status'], (msg) => {
      let text = '<b>Game status</b>:\n';
      for (let i=0; i < gameState.getCivs().length; i++) {
        let civ = gameState.getCiv(i);
        text += fixedLength(civ.ready ? '*' : '_', 3);
        text += fixedLength(civ.score, 5);
        text += civ.name;
        text += '\n';
      }
      bot.sendMessage(msg.from.id, text, {parse: 'html'});
    });

    bot.on(['/start'], (msg) => {
        const id = msg.from.id;

        let [civList,markup] = buildCivList(gameState.getCivs(), '/start');
        let text = opt.msg.startStepWelcome + civList;

        // Ask for the user's civilisation
        return bot.sendMessage(id, text, {markup, ask: 'civ', parse: 'markdown'});
    });

    // Callback for when we ask for the user's civilisation
    function onAskForCiv(msg) {
        const id = msg.from.id;
        const respNr = parseInt(msg.text, 10) - 1; // index in our player list
        console.log('the user responded with an civ number which is', respNr);

        if (respNr >= 0 && respNr < gameState.getCivs().length && gameState.getCiv(respNr)) {
            // valid selection - save player's civ and ask for enemies
            botState.setUser({
                civ: respNr,
                id,
                enemyCivs: [],
                lastNotifiedRound: gameState.getRound()
            });
            botState.saveData();
            return onStartUpdateEnemies(msg);
        } else {
            return bot.sendMessage(id, opt.msg.startWrongCiv, {ask: 'civ'});
        }
    }

    bot.on('ask.civ', onAskForCiv);

    function onStartUpdateEnemies(msg) {
      const id = msg.from.id;
      let [civList, markup] = buildCivList(gameState.getCivs(), opt.msg.noEnemyResponse);
      let text = `Sehr schön, ${gameState.getCivForUser(id).name}.\n${opt.msg.startStepEnemies}${civList}`;

      // Ask for the user's civilisation
      return bot.sendMessage(id, text, {markup, ask: 'enemies', parse: 'markdown'});
    }

    bot.on(['/setenemies'], onStartUpdateEnemies);

    // Callback for when we ask for the user's enemies
    bot.on('ask.enemies', (msg) => {
      const id = msg.from.id;
      const respNr = parseInt(msg.text, 10) - 1; // index in our player list. Minus one since the gui list starts with 1.
      const user = botState.getUser(id);
      console.log(`user ${id} chose ${respNr} as enemy`);

      if (!user) {
        // the message came from an user which did not select an civ yet.
        onAskForCiv(msg);
        return;
      }

      if (msg.text === opt.msg.noMoreEnemiesResponse || msg.text === opt.msg.noEnemyResponse) {
        // the user has listed all enemies
        if (botState.getUser(id).enemyCivs && botState.getUser(id).enemyCivs.length > 0) {
           return bot.sendMessage(id, opt.msg.notificationsEnabledNowWithEnemies, {markup: 'hide', parse: 'markdown'});
        } else {
          return bot.sendMessage(id, opt.msg.notificationsEnabledNow, {markup: 'hide', parse: 'markdown'});
        }

      } else if (respNr >= 0 && respNr < gameState.getCivs().length && gameState.getCiv(respNr)) {
        // add the enemy to the list
        user.enemyCivs = user.enemyCivs || [];
        user.enemyCivs.push(respNr);

        let civs = [];

        // ask for more civs, but add an NO button
        for (let i=0; i < gameState.getCivs().length; i++) {
          if (user.civ !== i && user.enemyCivs.indexOf(i) === -1) {
            // only list other civs, not the current user
            // also skip already listed civs
            civs.push(gameState.getCiv(i));
          }
        }
        let [civList, markup] = buildCivList(civs, opt.msg.noMoreEnemiesResponse);

        return bot.sendMessage(id, `${gameState.getCiv(respNr).name}, ok. ${opt.msg.youHaveMorEnemies}`, {markup, ask: 'enemies'});

      } else {
        // this is an invalid response
        return bot.sendMessage(id, opt.msg.startWrongCiv, {ask: 'enemies'});
      }
    });

    // force update
    bot.on('/update', () => {
        sendNotifications();
        return true;
    });
};
