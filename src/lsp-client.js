import net from 'net';
import { EventEmitter } from 'events';

/**
 * Language Server Protocol client for Godot
 * 
 * LSP uses JSON-RPC 2.0 over TCP with Content-Length headers (similar to DAP)
 */
export class LSPClient extends EventEmitter {
  constructor(host = '127.0.0.1', port = 6005) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.buffer = '';
    this.pendingRequests = new Map();
    this.sequence = 1;
    this.connected = false;
    this.initialized = false;
  }

  /**
   * Connect to the Godot LSP port
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host, () => {
        this.connected = true;
        console.error(`Connected to Godot LSP port at ${this.host}:${this.port}`);
        
        // Send initialize request
        this.sendRequest('initialize', {
          processId: process.pid,
          clientInfo: {
            name: 'godot-mcp-server',
            version: '1.0.0'
          },
          rootUri: null,
          capabilities: {
            textDocument: {
              hover: {
                contentFormat: ['markdown', 'plaintext']
              },
              completion: {
                completionItem: {
                  snippetSupport: true,
                  documentationFormat: ['markdown', 'plaintext']
                }
              },
              definition: {
                linkSupport: true
              },
              documentSymbol: {
                hierarchicalDocumentSymbolSupport: true
              }
            },
            workspace: {
              symbol: {
                symbolKind: {
                  valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                }
              }
            }
          }
        }).then((result) => {
          this.initialized = true;
          // Send initialized notification
          this.sendNotification('initialized', {});
          console.error('LSP initialized successfully');
          resolve(result);
        }).catch(reject);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error) => {
        console.error('LSP socket error:', error.message);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        console.error('LSP connection closed');
        this.connected = false;
        this.initialized = false;
      });

      // Set a timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('LSP connection timeout'));
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
        console.error('Error parsing LSP message:', error);
      }
    }
  }

  /**
   * Handle a parsed LSP message
   */
  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      // Response to our request
      const handler = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        handler.reject(new Error(message.error.message || 'LSP request failed'));
      } else {
        handler.resolve(message.result);
      }
    } else if (message.method) {
      // Notification or request from server
      this.emit('notification', message);
    }
  }

  /**
   * Send an LSP request
   */
  async sendRequest(method, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to Godot LSP port');
    }

    const id = this.sequence++;
    const request = {
      jsonrpc: '2.0',
      id: id,
      method: method,
      params: params
    };

    const message = JSON.stringify(request);
    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.socket.write(header + message, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('LSP request timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Send an LSP notification (no response expected)
   */
  sendNotification(method, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to Godot LSP port');
    }

    const notification = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };

    const message = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    this.socket.write(header + message);
  }

  /**
   * Notify LSP that a document was opened
   */
  didOpenTextDocument(uri, languageId = 'gdscript', version = 1, text = '') {
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: uri,
        languageId: languageId,
        version: version,
        text: text
      }
    });
  }

  /**
   * Get diagnostics for a document
   * Note: LSP sends diagnostics as notifications, so we need to listen for them
   */
  async getDocumentDiagnostics(uri) {
    // In LSP, diagnostics are sent as notifications after didOpen or didChange
    // We'll need to track them separately
    throw new Error('Use diagnostic notifications from the server instead');
  }

  /**
   * Get hover information at a position
   */
  async hover(uri, line, character) {
    if (!this.initialized) {
      throw new Error('LSP not initialized');
    }

    return this.sendRequest('textDocument/hover', {
      textDocument: { uri: uri },
      position: { line: line, character: character }
    });
  }

  /**
   * Get definition location
   */
  async definition(uri, line, character) {
    if (!this.initialized) {
      throw new Error('LSP not initialized');
    }

    return this.sendRequest('textDocument/definition', {
      textDocument: { uri: uri },
      position: { line: line, character: character }
    });
  }

  /**
   * Get completion suggestions
   */
  async completion(uri, line, character) {
    if (!this.initialized) {
      throw new Error('LSP not initialized');
    }

    return this.sendRequest('textDocument/completion', {
      textDocument: { uri: uri },
      position: { line: line, character: character }
    });
  }

  /**
   * Get document symbols
   */
  async documentSymbols(uri) {
    if (!this.initialized) {
      throw new Error('LSP not initialized');
    }

    return this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri: uri }
    });
  }

  /**
   * Search for workspace symbols
   */
  async workspaceSymbols(query = '') {
    if (!this.initialized) {
      throw new Error('LSP not initialized');
    }

    return this.sendRequest('workspace/symbol', {
      query: query
    });
  }

  /**
   * Disconnect from the LSP port
   */
  disconnect() {
    if (this.socket) {
      if (this.initialized) {
        // Send shutdown request
        this.sendRequest('shutdown', {}).then(() => {
          this.sendNotification('exit', {});
          this.socket.destroy();
        }).catch(() => {
          this.socket.destroy();
        });
      } else {
        this.socket.destroy();
      }
      this.socket = null;
      this.connected = false;
      this.initialized = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Check if initialized
   */
  isInitialized() {
    return this.initialized;
  }
}
