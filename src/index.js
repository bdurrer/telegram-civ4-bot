/*
 Main script to start the bot

 */

// const fs = require('fs');
const path = require('path');
const TeleBot = require('telebot');
const AskModule = require('telebot/modules/ask.js');
const Civ4Module = require('./module-civ4bot.js');

// read the config from the run params, if present
const args = process.argv.splice(2);

const configPath = ((args.length >= 1) ? path.join(__dirname, '..', args[0]) : path.join(__dirname, '/../config/options.js'));
console.log('\n=============================================================================================================');
console.log('\nStarting Telegram Bot with arguments', args, '. Loading config file', configPath);
console.log('\n=============================================================================================================');
const config = require(configPath);

const bot = new TeleBot(config);
bot.use(AskModule);
bot.use(Civ4Module);

// On every text message
/*
bot.on('text', (msg) => {
    let id = msg.from.id;
    let text = msg.text;
    console.log('DEBUG got a text message from ', id, ', it said ', text);
    return bot.sendMessage(id, `DEBUG: You said: ${text}`);
});
*/

bot.connect();

process.on('SIGINT', function () {
    console.log('Gracefully shutting down bot from SIGINT (Ctrl-C)');
    // some other closing procedures go here
    bot.disconnect('Civ Status Bot terminated.');
    process.exit();
});
