import * as signalR from '@microsoft/signalr';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration
const SIGNALR_URL = process.env.SIGNALR_URL || 'http://localhost/chat';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

interface TestResult {
  success: boolean;
  transport?: string;
  error?: string;
  connectionId?: string;
  duration: number;
}

class SignalRWebSocketTester {
  private connection: signalR.HubConnection | null = null;

  async testConnection(): Promise<TestResult> {
    const startTime = Date.now();
    
    console.log('🔧 SignalR WebSocket Connection Test');
    console.log('');

    try {
      // Test 1: Using accessTokenFactory (recommended for OAuth)
      console.log('🧪 Test 1: Using accessTokenFactory');
      const result1 = await this.testWithAccessTokenFactory();
      if (result1.success) return result1;

      // Test 2: Using query string directly
      console.log('🧪 Test 2: Using query string directly');
      const result2 = await this.testWithQueryString();
      if (result2.success) return result2;

      // Test 3: Using headers (fallback)
      console.log('🧪 Test 3: Using headers');
      const result3 = await this.testWithHeaders();
      if (result3.success) return result3;

      return {
        success: false,
        error: 'All connection methods failed',
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private async testWithAccessTokenFactory(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(SIGNALR_URL, {
          accessTokenFactory: () => {
            console.log('🔐 accessTokenFactory called');
            return Promise.resolve(ACCESS_TOKEN);
          },
          transport: signalR.HttpTransportType.WebSockets,
          skipNegotiation: false,
          withCredentials: true
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Debug)
        .build();

      this.setupEventHandlers();

      console.log('🚀 Starting connection with accessTokenFactory...');
      await this.connection.start();
      
      const transport = this.getTransportType();
      console.log('✅ Connection successful!');
      console.log('🚂 Transport:', transport);
      console.log('🆔 Connection ID:', this.connection.connectionId);

      return {
        success: true,
        transport,
        connectionId: this.connection.connectionId || undefined,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.log('❌ accessTokenFactory failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    } finally {
      // Don't cleanup immediately if we're testing hub methods
      if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
        // Keep connection for hub method testing
        console.log('⏱️ Keeping connection for hub method testing...');
      } else {
        await this.cleanup();
      }
    }
  }

  private async testWithQueryString(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const urlWithToken = `${SIGNALR_URL}?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(urlWithToken, {
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          skipNegotiation: false,
          withCredentials: true
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Debug)
        .build();

      this.setupEventHandlers();

      console.log('🚀 Starting connection with query string...');
      await this.connection.start();
      
      const transport = this.getTransportType();
      console.log('✅ Connection successful!');
      console.log('🚂 Transport:', transport);
      console.log('🆔 Connection ID:', this.connection.connectionId);

      return {
        success: true,
        transport,
        connectionId: this.connection.connectionId || undefined,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.log('❌ Query string failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    } finally {
      await this.cleanup();
    }
  }

  private async testWithHeaders(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(SIGNALR_URL, {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          },
          transport: signalR.HttpTransportType.WebSockets, // Headers don't work with WebSockets
          skipNegotiation: false,
          withCredentials: true
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Debug)
        .build();

      this.setupEventHandlers();

      console.log('🚀 Starting connection with headers (Long Polling only)...');
      await this.connection.start();
      
      const transport = this.getTransportType();
      console.log('✅ Connection successful!');
      console.log('🚂 Transport:', transport);
      console.log('🆔 Connection ID:', this.connection.connectionId);

      return {
        success: true,
        transport,
        connectionId: this.connection.connectionId || undefined,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.log('❌ Headers failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    } finally {
      await this.cleanup();
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.onclose((error) => {
      console.log('🔌 Connection closed:', error?.message || 'Normal closure');
    });

    this.connection.onreconnecting((error) => {
      console.log('🔄 Reconnecting:', error?.message || 'Unknown reason');
    });

    this.connection.onreconnected((connectionId) => {
      console.log('🔗 Reconnected with ID:', connectionId);
    });

    // Test basic hub methods
    this.connection.on('ConversationHistory', (convoId: string, messages: any[]) => {
      console.log('📨 Received ConversationHistory:', convoId, messages.length, 'messages');
    });

    this.connection.on('UserMessage', (convoId: string, message: any) => {
      console.log('📨 Received UserMessage:', convoId, message);
    });

    this.connection.on('Pong', (timestamp: string) => {
      console.log('🏓 Received Pong response at:', timestamp);
    });
  }

  private getTransportType(): string {
    if (!this.connection) return 'Unknown';
    
    try {
      // Try to detect transport type using various methods
      const conn = (this.connection as any).connection;
      if (conn?.transport) {
        const transport = conn.transport;
        
        // Check constructor name
        if (transport.constructor?.name) {
          const name = transport.constructor.name;
          if (name.includes('WebSocket')) return 'WebSockets';
          if (name.includes('LongPolling')) return 'Long Polling';
          if (name.includes('ServerSentEvents')) return 'Server-Sent Events';
          return name;
        }
        
        // Check for specific transport objects
        if (transport._webSocket || transport.webSocket) return 'WebSockets';
        if (transport._pollXhr || transport._longRunningPoller || transport.xhr) return 'Long Polling';
        if (transport._eventSource || transport.eventSource) return 'Server-Sent Events';
        
        // Check name property
        if (transport.name) return transport.name;
      }
      
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  public async cleanup(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (error) {
        console.log('⚠️ Error during cleanup:', error instanceof Error ? error.message : error);
      }
      this.connection = null;
    }
  }

  async testBasicHubMethods(): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      console.log('❌ Cannot test hub methods - connection not established');
      return;
    }

    try {
      console.log('🧪 Testing basic hub methods...');
      console.log('⏱️ Keeping connection open for 5 seconds to listen for any server messages...');
      
      // Wait for a few seconds to see if we receive any messages
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📞 Testing if we can send a simple ping...');
      
      // Try to call the Ping method
      try {
        await this.connection.invoke('Ping');
        console.log('✅ Ping successful - method exists and works!');
      } catch (error) {
        console.log('⚠️ Ping failed:', 
          error instanceof Error ? error.message : error);
      }
      
    } catch (error) {
      console.log('❌ Hub method test failed:', error instanceof Error ? error.message : error);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Starting SignalR WebSocket Test');
  console.log('═'.repeat(60));
  
  // Validate environment variables
  if (!ACCESS_TOKEN) {
    console.error('❌ ACCESS_TOKEN environment variable is required');
    console.error('💡 Set it like: ACCESS_TOKEN=your_jwt_token pnpm run dev');
    process.exit(1);
  }
  
  console.log('📍 URL:', SIGNALR_URL);
  console.log('🔑 Token length:', ACCESS_TOKEN.length);
  console.log('🔑 Token preview:', ACCESS_TOKEN.substring(0, 50) + '...');
  console.log('');
  
  const tester = new SignalRWebSocketTester();
  
  try {
    const result = await tester.testConnection();
    
    console.log('');
    console.log('📊 Test Results:');
    console.log('═'.repeat(60));
    console.log('Success:', result.success ? '✅ YES' : '❌ NO');
    console.log('Duration:', result.duration + 'ms');
    
    if (result.success) {
      console.log('Transport:', result.transport);
      console.log('Connection ID:', result.connectionId);
      
      // Test basic hub functionality
      await tester.testBasicHubMethods();
      
      // Cleanup after hub method testing
      await tester.cleanup();
    } else {
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error instanceof Error ? error.message : error);
  }
  
  console.log('');
  console.log('🏁 Test completed');
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
