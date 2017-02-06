# telegram-civ4-bot
This is a Telegram bot which sends push notifications for an Civilization 4 game.
It requires a PitBossInfo website to pull the current status from. See [RafiKueng/PitBossInfo](https://github.com/RafiKueng/PitBossInfo) on how to setup PitBossInfo.


## usage

* register a bot with BotFather
* clone/download this the repo
* modify (or copy) the configuration under config/options.js and at least enter your bot api key.
* install [nodejs/npm](http://nodejs.org/) if you don't have it.
* run `npm install` inside the project folder to pull in all dependencies
* run the bot with `node src/index.js [config/yourconfig.js]` (execute in the project folder)
