const fs = require('fs');


module.exports = (bot, opt) => {

  // here is where we keep the user settings. They are saved to disk too
  state = {
    users: {}
  };

  // Load config data
  function loadData(){
    try {
        state = JSON.parse(fs.readFileSync(opt.botStateSaveFileName));
        console.log('loaded state is: ', state);
    } catch (e) {
        console.log('there is no bot-state file yet, creating it now');
        fs.writeFileSync(opt.botStateSaveFileName, '{users: {}}');
    }
  }

  function saveData() {
      console.log('saving game state to disk', state);
      fs.writeFileSync(opt.botStateSaveFileName, JSON.stringify(state));
  }

  function getUsers(){
    return state.users;
  }

  function getUser(id) {
    return state.users['u' + id];
  }

  function setUser(user){
    state.users['u' + user.id] = user;
  }

  return {
    loadData,
    saveData,
    getUsers,
    getUser,
    setUser
  };

};
