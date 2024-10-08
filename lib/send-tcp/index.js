const { createConnection } = require('net');

const ENCODING = 'ascii';

/**
 * Timeout ID
 * @type {number}
 */
let timer;

/**
 * Maximum idle time to leave a socket open
 * @type {number}
 */
const SOCKET_TIMEOUT = 3000;

/**
 * Private socket instance
 * @type {Socket}
 */
let socket = null;

/**
 * Socket is closing
 * @type {Boolean}
 */
let closing = false;

/**
 * Tear-down operation registered
 * @type {Boolean}
 */
let teardown = false;

/**
 * Return socket instance or create one when missing
 * @param  {String} port
 * @param  {String} host
 * @return {Socket}
 */
function getSocket(port, host) {
    socket = socket || createConnection(port, host).setKeepAlive(true);

    clearTimeout(timer);
    timer = setTimeout(endSocket, SOCKET_TIMEOUT);

    return socket;
}

/**
 * Destroy socket instance and unlink it for garbage collection
 * @return {undefined}
 */
function endSocket() {
    if (closing) {
        return;
    }
    closing = true;
    socket && socket.end(derefSocket);
    process.off('exit', endSocket);
}

/**
 * De ref socket. Set "closing" to false
 * @return {undefined}
 */
function derefSocket() {
    closing = false;
    socket = null;
}

/**
 * @typedef Send
 * @type {Function}
 * @description Send a message over a TCP socket. Return nothing
 * @param  {String} data
 * @return {Socket}
 */

/**
 * Create a socket send method
 * @param  {String}   port
 * @param  {String}   host
 * @param  {Function} [errorHandler]
 * @param  {Object}   [auth]
 * @return {Send}
 */
module.exports = function createSender(port, host, errorHandler, auth) {

    /**
     * Write data to TCP socket
     * @param {string} data
     * @returns {boolean}
     */
    function sender(data) {
        if (!teardown) {
            process.on('exit', endSocket);
            teardown = true;
        }

        let buffer;
        if (auth && auth.password) {
            const newData = auth.password + (auth.delimiter ?? "::") + data;
            buffer = Buffer.from(newData);
        } else {
            buffer = Buffer.from(data);
        }

        return getSocket(port, host)
            .write(
                Buffer.from(data),
                ENCODING,
                (error) => {
                    if (error) {
                        endSocket();
                        errorHandler && errorHandler(error, data);
                    }
                }
            );
    }

    sender.destroy = endSocket;
    return sender;
};
