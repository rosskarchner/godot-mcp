import net from 'net';
import { EventEmitter } from 'events';

/**
 * Debug Adapter Protocol client for Godot
 */
export class DAPClient extends EventEmitter {
  constructor(host = '127.0.0.1', port = 6006) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.buffer = '';
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.sequence = 1;
    this.connected = false;
  }

  /**
   * Connect to the Godot debug port
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host, () => {
        this.connected = true;
        console.error('Connected to Godot debug port at ' + this.host + ':' + this.port);
        
        // Send initialize request
        this.sendRequest('initialize', {
          clientID: 'godot-mcp-server',
          adapterID: 'godot',
          linesStartAt1: true,
          columnsStartAt1: true,
          pathFormat: 'path'
        }).then(() => {
          resolve();
        }).catch(reject);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error.message);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        console.error('Connection closed');
        this.connected = false;
      });

      // Set a timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Handle incoming data from the socket
   */
  handleData(data) {
    this.buffer += data.toString();
    
    // Process complete messages
    while (true) {
      const match = this.buffer.match(/^Content-Length: (\d+)\r?\n\r?\n/);
      if (!match) break;
      
      const contentLength = parseInt(match[1]);
      const headerLength = match[0].length;
      const totalLength = headerLength + contentLength;
      
      if (this.buffer.length < totalLength) break;
      
      const messageContent = this.buffer.substring(headerLength, totalLength);
      this.buffer = this.buffer.substring(totalLength);
      
      try {
        const message = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }
  }

  /**
   * Handle a parsed DAP message
   */
  handleMessage(message) {
    if (message.type === 'response') {
      const handler = this.pendingRequests.get(message.request_seq);
      if (handler) {
        this.pendingRequests.delete(message.request_seq);
        if (message.success) {
          handler.resolve(message.body || {});
        } else {
          handler.reject(new Error(message.message || 'Request failed'));
        }
      }
    } else if (message.type === 'event') {
      this.emit('event', message);
    }
  }

  /**
   * Send a DAP request
   */
  async sendRequest(command, args = {}, timeout = null) {
    if (!this.connected) {
      throw new Error('Not connected to Godot debug port');
    }

    const seq = this.sequence++;
    const request = {
      type: 'request',
      seq: seq,
      command: command,
      arguments: args
    };

    const message = JSON.stringify(request);
    const header = `Content-Length: ${message.length}\r\n\r\n`;

    // Set timeout based on command type if not explicitly provided
    if (timeout === null) {
      // Commands that may take longer
      const longRunningCommands = ['evaluate', 'continue', 'stepIn', 'stepOut', 'next'];
      timeout = longRunningCommands.includes(command) ? 30000 : 10000;
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(seq, { resolve, reject });

      this.socket.write(header + message, (error) => {
        if (error) {
          this.pendingRequests.delete(seq);
          reject(error);
        }
      });

      // Timeout based on command type or explicit parameter
      setTimeout(() => {
        if (this.pendingRequests.has(seq)) {
          this.pendingRequests.delete(seq);
          reject(new Error(`Request timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  /**
   * Disconnect from the debug port
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}
