const http = require('http'),
      cheerio = require('cheerio');


module.exports = (bot, opt, stateHandler) => {

  let gameState = {
      round: 0,
      players: [
          /* {id: 0, name: 'Anubis', ready: false} */
      ]
  };

  function getCivs() {
    return gameState.players;
  }

  function getCiv(idx) {
    return gameState.players[idx];
  }

  function getCivForUser(id) {
    let userObj = stateHandler.getUser(id);
    if (userObj){
      return gameState.players[userObj.civ];
    } else {
      console.log(`access error on getCivForUser(${id}) - no such user`);
      return null;
    }
  }

  function getRound() {
    return gameState.round;
  }


  /**
   * fetches the game state from the website and triggers an update, if anything changed
   */
  function updateGameState(){
    return new Promise((resolve, reject) => {
      http.get(opt.statusPageUrl, (res) => {
        const statusCode = res.statusCode;
        if (statusCode !== 200) {
          console.log(`Status update from ${opt.statusPageUrl} failed with response code ${statusCode}. Next try in ${opt.updateInterval} seconds.`);
          res.resume();
          reject(statusCode);
          return;
        }

        // Continuously update stream with data
        let body = '';
        res.on('data', (d) => {
            body += d;
        });
        res.on('end', () => parseResponse(body, resolve, reject));
      }).on('error', (e) => reject(e));
    });
  }


  function parseResponse(responseHtml, resolve, reject){
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

      if (gameHasChanged) {
        console.log(`New round ${currentRound} has started!`);
      } else {
        console.log('Updated game state from status page.');
      }
      resolve(gameHasChanged);
    } catch (e) {
      console.error('Oops, an error occured when parsing the game state from the remote website!', e);
      reject(e);
    }
  }


  return {
    getCiv,
    getCivForUser,
    getCivs,
    getRound,
    updateGameState
  };
};
