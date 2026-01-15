/**
 * SvonyBridge - Fiddler CustomRules Script
 * 
 * This script captures Evony game traffic in Fiddler and forwards it to
 * Svony Browser via Named Pipes for real-time analysis.
 * 
 * INSTALLATION:
 * 1. Open Fiddler
 * 2. Go to Rules > Customize Rules (or press Ctrl+R)
 * 3. Add this code to the Handlers class in CustomRules.js
 * 4. Save and restart Fiddler
 * 
 * REQUIREMENTS:
 * - Fiddler Classic or Fiddler Everywhere
 * - Svony Browser running with FiddlerBridge service active
 * - .NET Framework for Named Pipes support
 */

import System;
import System.IO;
import System.IO.Pipes;
import System.Text;
import System.Threading;
import Fiddler;

class Handlers {
    // Named pipe configuration
    static var pipeName: String = "SvonyFiddlerBridge";
    static var pipeClient: NamedPipeClientStream = null;
    static var pipeWriter: StreamWriter = null;
    static var isConnected: Boolean = false;
    static var reconnectAttempts: int = 0;
    static var maxReconnectAttempts: int = 5;
    static var reconnectDelay: int = 2000; // ms
    
    // Evony server patterns
    static var evonyPatterns: String[] = [
        "evony.com",
        "cc2.evony.com",
        "cc3.evony.com",
        "cc4.evony.com",
        "cc5.evony.com",
        "evonycdn.com",
        "evonygame.com"
    ];
    
    // Session tracking
    static var sessionCounter: int = 0;
    static var capturedPackets: int = 0;
    
    /**
     * Initialize connection to Svony Browser
     */
    static function ConnectToPipe(): Boolean {
        try {
            if (pipeClient != null && pipeClient.IsConnected) {
                return true;
            }
            
            // Close existing connection if any
            DisconnectPipe();
            
            // Create new pipe client
            pipeClient = new NamedPipeClientStream(
                ".",                    // Local machine
                pipeName,               // Pipe name
                PipeDirection.Out,      // Write only
                PipeOptions.Asynchronous
            );
            
            // Attempt connection with timeout
            pipeClient.Connect(1000);
            
            if (pipeClient.IsConnected) {
                pipeWriter = new StreamWriter(pipeClient);
                pipeWriter.AutoFlush = true;
                isConnected = true;
                reconnectAttempts = 0;
                
                FiddlerApplication.Log.LogString(
                    "[SvonyBridge] Connected to Svony Browser"
                );
                
                // Send connection notification
                SendMessage({
                    "Type": "connection",
                    "Status": "connected",
                    "Timestamp": DateTime.UtcNow.ToString("o")
                });
                
                return true;
            }
        }
        catch (ex: TimeoutException) {
            FiddlerApplication.Log.LogString(
                "[SvonyBridge] Connection timeout - Svony Browser not running?"
            );
        }
        catch (ex: Exception) {
            FiddlerApplication.Log.LogString(
                "[SvonyBridge] Connection error: " + ex.Message
            );
        }
        
        isConnected = false;
        return false;
    }
    
    /**
     * Disconnect from pipe
     */
    static function DisconnectPipe() {
        try {
            if (pipeWriter != null) {
                pipeWriter.Close();
                pipeWriter = null;
            }
            if (pipeClient != null) {
                pipeClient.Close();
                pipeClient = null;
            }
        }
        catch (ex) {
            // Ignore cleanup errors
        }
        isConnected = false;
    }
    
    /**
     * Send message to Svony Browser
     */
    static function SendMessage(data: Object): Boolean {
        if (!isConnected) {
            // Attempt reconnection
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                if (!ConnectToPipe()) {
                    return false;
                }
            } else {
                return false;
            }
        }
        
        try {
            var json = Fiddler.WebFormats.JSON.JsonEncode(data);
            pipeWriter.WriteLine(json);
            return true;
        }
        catch (ex: IOException) {
            FiddlerApplication.Log.LogString(
                "[SvonyBridge] Write error: " + ex.Message
            );
            isConnected = false;
            return false;
        }
        catch (ex: Exception) {
            FiddlerApplication.Log.LogString(
                "[SvonyBridge] Send error: " + ex.Message
            );
            return false;
        }
    }
    
    /**
     * Check if session is Evony traffic
     */
    static function IsEvonyTraffic(oSession: Session): Boolean {
        var host = oSession.hostname.ToLower();
        
        for (var i = 0; i < evonyPatterns.length; i++) {
            if (host.Contains(evonyPatterns[i])) {
                return true;
            }
        }
        
        // Also check URL path for Evony-specific endpoints
        var path = oSession.PathAndQuery.ToLower();
        if (path.Contains("/gateway.php") || 
            path.Contains("/amf") ||
            path.Contains("/evony")) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Extract AMF action from request body
     */
    static function ExtractAmfAction(body: byte[]): String {
        if (body == null || body.Length < 10) {
            return "unknown";
        }
        
        try {
            // Look for string marker (0x06) followed by action name
            for (var i = 0; i < Math.Min(body.Length - 5, 200); i++) {
                if (body[i] == 0x06) {
                    // Read string length (variable-length encoding)
                    var len = body[i + 1];
                    if ((len & 0x01) == 1) {
                        len = (len >> 1);
                        if (len > 0 && len < 100 && i + 2 + len <= body.Length) {
                            var str = Encoding.UTF8.GetString(body, i + 2, len);
                            // Check if it looks like an action name
                            if (str.Contains(".") && !str.Contains("/")) {
                                return str;
                            }
                        }
                    }
                }
            }
        }
        catch (ex) {
            // Ignore parsing errors
        }
        
        return "unknown";
    }
    
    /**
     * Called before each request is sent
     */
    static function OnBeforeRequest(oSession: Session) {
        // Skip non-Evony traffic
        if (!IsEvonyTraffic(oSession)) {
            return;
        }
        
        // Mark as Evony traffic in Fiddler UI
        oSession["ui-color"] = "gold";
        oSession["ui-bold"] = "true";
        oSession["x-svony-captured"] = "true";
        
        sessionCounter++;
        
        // Prepare request data
        var requestBody = oSession.RequestBody;
        var action = ExtractAmfAction(requestBody);
        
        var data = {
            "Type": "request",
            "SessionId": oSession.id.ToString(),
            "SequenceNumber": sessionCounter,
            "Timestamp": DateTime.UtcNow.ToString("o"),
            "Data": {
                "url": oSession.fullUrl,
                "method": oSession.RequestMethod,
                "host": oSession.hostname,
                "path": oSession.PathAndQuery,
                "action": action,
                "contentType": oSession.RequestHeaders["Content-Type"] || "",
                "contentLength": requestBody != null ? requestBody.Length : 0,
                "body": requestBody != null ? Convert.ToBase64String(requestBody) : "",
                "headers": {}
            }
        };
        
        // Include relevant headers
        for (var header in oSession.RequestHeaders) {
            if (header.Name.StartsWith("X-") || 
                header.Name == "Cookie" ||
                header.Name == "Authorization") {
                data.Data.headers[header.Name] = header.Value;
            }
        }
        
        // Send to Svony Browser
        if (SendMessage(data)) {
            capturedPackets++;
        }
    }
    
    /**
     * Called before each response is returned
     */
    static function OnBeforeResponse(oSession: Session) {
        // Skip non-Evony traffic
        if (oSession["x-svony-captured"] != "true") {
            return;
        }
        
        // Prepare response data
        var responseBody = oSession.ResponseBody;
        var action = ExtractAmfAction(responseBody);
        
        var data = {
            "Type": "response",
            "SessionId": oSession.id.ToString(),
            "Timestamp": DateTime.UtcNow.ToString("o"),
            "Data": {
                "url": oSession.fullUrl,
                "statusCode": oSession.responseCode,
                "statusText": oSession.ResponseHeaders.HTTPResponseStatus,
                "action": action,
                "contentType": oSession.ResponseHeaders["Content-Type"] || "",
                "contentLength": responseBody != null ? responseBody.Length : 0,
                "body": responseBody != null ? Convert.ToBase64String(responseBody) : "",
                "timing": {
                    "clientConnected": oSession.Timers.ClientConnected.ToString("o"),
                    "serverGotRequest": oSession.Timers.ServerGotRequest.ToString("o"),
                    "serverBeginResponse": oSession.Timers.ServerBeginResponse.ToString("o"),
                    "serverDoneResponse": oSession.Timers.ServerDoneResponse.ToString("o")
                }
            }
        };
        
        // Send to Svony Browser
        SendMessage(data);
    }
    
    /**
     * Called when Fiddler starts
     */
    static function OnBoot() {
        FiddlerApplication.Log.LogString(
            "[SvonyBridge] Initializing Evony traffic capture..."
        );
        
        // Attempt initial connection
        ConnectToPipe();
        
        FiddlerApplication.Log.LogString(
            "[SvonyBridge] Ready - Capturing traffic from: " + 
            String.Join(", ", evonyPatterns)
        );
    }
    
    /**
     * Called when Fiddler shuts down
     */
    static function OnShutdown() {
        FiddlerApplication.Log.LogString(
            "[SvonyBridge] Shutting down - Captured " + 
            capturedPackets + " packets"
        );
        
        // Send disconnect notification
        SendMessage({
            "Type": "connection",
            "Status": "disconnected",
            "PacketsCaptured": capturedPackets
        });
        
        DisconnectPipe();
    }
    
    /**
     * Menu item to manually reconnect
     */
    public static RulesOption("Svony Bridge: Reconnect")
    var m_SvonyReconnect: boolean = false;
    
    static function OnBeforeReturningError(oSession: Session) {
        if (m_SvonyReconnect) {
            m_SvonyReconnect = false;
            DisconnectPipe();
            if (ConnectToPipe()) {
                FiddlerApplication.Log.LogString(
                    "[SvonyBridge] Reconnected successfully"
                );
            }
        }
    }
    
    /**
     * Menu item to show capture stats
     */
    public static RulesOption("Svony Bridge: Show Stats")
    var m_SvonyStats: boolean = false;
    
    static function OnPeekAtResponseHeaders(oSession: Session) {
        if (m_SvonyStats) {
            m_SvonyStats = false;
            FiddlerApplication.Log.LogString(
                "[SvonyBridge] Stats - Sessions: " + sessionCounter +
                ", Captured: " + capturedPackets +
                ", Connected: " + isConnected
            );
        }
    }
}

/**
 * USAGE NOTES:
 * 
 * 1. This script automatically captures all Evony game traffic
 * 2. Traffic is forwarded to Svony Browser via Named Pipes
 * 3. Use the Rules menu to reconnect or view stats
 * 4. Captured sessions are highlighted in gold in Fiddler
 * 
 * TROUBLESHOOTING:
 * 
 * - If not connecting: Ensure Svony Browser is running first
 * - If packets not captured: Check Fiddler is set as system proxy
 * - If AMF not decoded: Ensure game traffic goes through Fiddler
 * 
 * For more information, see the Svony Browser documentation.
 */
