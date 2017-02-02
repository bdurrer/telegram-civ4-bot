module.exports = {
  token: '-PASTEYOURTELEGRAMBOTAPITOKENHERE-', // Required. Telegram Bot API token.
  polling: { // Optional. Use polling.
    interval: 15000, // Optional. How often check updates (in ms).
    timeout: 14000, // Optional. Update polling timeout (0 - short polling).
    limit: 100, // Optional. Limits the number of updates to be retrieved.
    retryTimeout: 5000 // Optional. Reconnecting timeout (in ms).
  },
  /*
  webhook: { // Optional. Use webhook instead of polling.
    key: '__YOUR_KEY__.pem', // Optional. Private key for server.
    cert: '__YOUR_CERT__.pem', // Optional. Public key.
    url: 'https://....', // HTTPS url to send updates to.
    host: '0.0.0.0', // Webhook server host.
    port: 443 // Server port.
  },
  */
  modules: {
    // Module configuration.
    civ4bot: {
        statusPageUrl: 'http://localhost:8080/pitboss.htm'
    }
  }
};