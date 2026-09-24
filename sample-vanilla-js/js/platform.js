/**
 * TTHSPlatformClient -- vanilla JS CUSS 2.0 WebSocket client for the TTHS kiosk platform.
 *
 * Reimplements the connection and initialization flow of the Next.js sample-app
 * (sample-app/src/lib/websocket/client.ts + sample-app/src/app/ws-debug-page/page.tsx)
 * without any framework or build step:
 *
 *   - Connects to the platform WebSocket endpoint (/platform/subscribe)
 *   - Waits for ConnectionStatus "master" before starting anything
 *   - Runs the 4-step ACK-chained init sequence:
 *       subscribe -> platform_environment -> platform_components
 *       -> platform_applications_staterequest (ACTIVE)
 *   - Answers platform PING messages with PONG and reconnects when PINGs stop
 *   - Reconnects with exponential backoff (1s -> 30s, 2x multiplier)
 *   - Never blocks: a directive sent while disconnected returns null
 *
 * Loaded as a classic script; exposes window.TTHSPlatformClient.
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** UUID v4 via CSPRNG, with a Math.random fallback for non-secure (http://) contexts. */
  function generateUUID() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Exponential backoff (copied from sample-app/src/lib/websocket/backoff.ts). */
  class ExponentialBackoff {
    constructor(initialDelay, maxDelay, multiplier) {
      this.initialDelay = typeof initialDelay === "number" ? initialDelay : 1000;
      this.maxDelay = typeof maxDelay === "number" ? maxDelay : 30000;
      this.multiplier = typeof multiplier === "number" ? multiplier : 2;
      this.currentDelay = this.initialDelay;
      this.attempts = 0;
    }

    nextDelay() {
      var delay = Math.min(this.currentDelay, this.maxDelay);
      this.currentDelay *= this.multiplier;
      this.attempts += 1;
      return delay;
    }

    reset() {
      this.currentDelay = this.initialDelay;
      this.attempts = 0;
    }

    getAttempts() {
      return this.attempts;
    }
  }

  // ---------------------------------------------------------------------------
  // Startup configuration (mirrors sample-app/src/lib/utils/config.ts)
  // ---------------------------------------------------------------------------

  /** Default development config; a real CUSS device passes all params in the launch URL. */
  var DEFAULT_CONFIG = {
    vendor: "DEV",
    apcd: "IST",
    alcd: "TK",
    deviceId: "NONE", // Valid per CUSS2-Schemas-domain_UniqueID
    oauthUrl: "https://localhost:8443/oauth",
    cussWss: "ws://localhost:8000/platform/subscribe",
  };

  /**
   * Resolve the CUSS 2.0 startup parameters (Section 3.1.2) from the page URL,
   * falling back to development defaults.
   * Priority: URL query param (VENDOR, APCD, ALCD, DEVICE-ID, OAUTH-URL, CUSS-WSS) > default.
   */
  function parseStartupParams() {
    var params = new URLSearchParams(global.location.search);
    return {
      vendor: params.get("VENDOR") || DEFAULT_CONFIG.vendor,
      apcd: params.get("APCD") || DEFAULT_CONFIG.apcd,
      alcd: params.get("ALCD") || DEFAULT_CONFIG.alcd,
      deviceId: params.get("DEVICE-ID") || DEFAULT_CONFIG.deviceId,
      oauthUrl: params.get("OAUTH-URL") || DEFAULT_CONFIG.oauthUrl,
      cussWss: params.get("CUSS-WSS") || DEFAULT_CONFIG.cussWss,
    };
  }

  // ---------------------------------------------------------------------------
  // Timing constants (same values as the sample-app)
  // ---------------------------------------------------------------------------

  var INIT_STEP_DELAY_MS = 200; // Delay between ACK-chained init steps
  var PING_CHECK_INTERVAL_MS = 10000; // PING timeout monitor interval
  var PING_TIMEOUT_MS_DEFAULT = 90000; // 60s PING interval + 30s grace

  // ---------------------------------------------------------------------------
  // TTHSPlatformClient
  // ---------------------------------------------------------------------------

  /**
   * Connection + init lifecycle manager.
   *
   * Events (subscribe via client.on(event, handler); the returned function unsubscribes):
   *   stateChange          -> "disconnected" | "connecting" | "connected" | "reconnecting"
   *   message              -> { direction: "in"|"out", data: parsed/raw message object }
   *   connectionStatus     -> raw ConnectionStatus message (master/rejected)
   *   master               -> raw ConnectionStatus message on acceptance
   *   rejected             -> raw ConnectionStatus message on rejection
   *   close                -> raw close event
   *   error                -> { source, message, detail? }
   *   initStep             -> { stepIndex, key, status: "sent"|"done", directive }
   *   initComplete         -> { steps: [...], applicationId }
   *   apiAcknowledgement   -> raw APIAcknowledgement message
   *   directiveResult      -> raw PlatformData with eventType DIRECTIVE_RESULT
   *   deviceCommandError   -> raw PlatformData with eventType DEVICE_COMMAND_ERROR
   *   deviceStatusChanged  -> raw deviceStatusChanged message
   *   applicationStateChanged -> raw PlatformData (APPLICATION_STATE_CHANGED)
   *   platformStateChanged    -> raw PlatformData (PLATFORM_STATE_CHANGED)
   *   componentList        -> payload.componentList array from platform_components
   */
  class TTHSPlatformClient {
    /**
     * @param {Object} [options]
     *   wsUrl           - WebSocket endpoint (default: resolved from URL params / ws://localhost:8000/platform/subscribe)
     *   applicationId   - subscribe applicationId   (default "tk-checkin", the platform's seeded default application)
     *   applicationName - subscribe name            (default "Turkish Airlines Check-in")
     *   vendor          - subscribe vendor          (default "THY")
     *   deviceId        - CUSS deviceID for meta    (default from URL params / "NONE")
     *   oauthUrl        - OAuth URL used as oauthToken placeholder (default from URL params)
     *   autoInit        - start the 4-step init automatically after "master" (default true)
     *   pingTimeoutMs   - reconnect when no PING within this window (default 90000)
     *   backoff         - { initialDelay, maxDelay, multiplier } reconnection tuning
     */
    constructor(options) {
      options = options || {};
      var resolved = parseStartupParams();

      this._config = {
        cussWss: options.wsUrl || resolved.cussWss,
        applicationId: options.applicationId || "tk-checkin",
        applicationName: options.applicationName || "Turkish Airlines Check-in",
        vendor: options.vendor || "THY",
        deviceId: options.deviceId || resolved.deviceId,
        oauthUrl: options.oauthUrl || resolved.oauthUrl,
        apcd: resolved.apcd,
        alcd: resolved.alcd,
      };
      this._autoInit = options.autoInit !== false;
      this._pingTimeoutMs = options.pingTimeoutMs || PING_TIMEOUT_MS_DEFAULT;

      var backoffOpts = options.backoff || {};
      this._backoff = new ExponentialBackoff(
        backoffOpts.initialDelay,
        backoffOpts.maxDelay,
        backoffOpts.multiplier
      );

      // Connection state
      this._ws = null;
      this._state = "disconnected";
      this._reconnectTimeout = null;
      this._intentionalDisconnect = false;
      this._connectionRejected = false; // Rejected master connections never auto-reconnect
      this._platformMode = null;

      // Keep-alive
      this._lastPingReceived = null;
      this._pingTimer = null;

      // Init sequence state
      this._waitingForMaster = false;
      this._initRunning = false;
      this._initSteps = [];
      this._initStepIndex = 0;
      this._pendingInitCorrelationId = null;
      this._initComplete = false;

      // Event emitter
      this._listeners = {}; // event -> [handler, ...]
    }

    // ------------------------------------------------------------------
    // Event emitter
    // ------------------------------------------------------------------

    /** Subscribe to an event. Returns an unsubscribe function. */
    on(event, handler) {
      if (typeof handler !== "function") {
        throw new TypeError("handler must be a function");
      }
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(handler);
      var self = this;
      return function unsubscribe() {
        self.off(event, handler);
      };
    }

    off(event, handler) {
      var list = this._listeners[event];
      if (!list) return;
      var idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }

    _emit(event, data) {
      var list = this._listeners[event];
      if (!list || list.length === 0) return;
      // Copy so handlers can unsubscribe while the event is being dispatched.
      list.slice().forEach(function (handler) {
        try {
          handler(data);
        } catch (err) {
          console.error("[TTHSPlatformClient] Error in '" + event + "' handler:", err);
        }
      });
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /** Open the WebSocket connection (idempotent). Init runs automatically after "master". */
    connect() {
      if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (this._connectionRejected) {
        console.warn("[TTHSPlatformClient] Connection was previously rejected; manual disconnect() required before retrying");
        return;
      }

      this._intentionalDisconnect = false;
      this._backoff.reset();
      this._setState("connecting");

      // Init state belongs to the previous connection; a fresh master message re-triggers it.
      this._waitingForMaster = false;
      this._resetInitState();

      var url = this._config.cussWss;
      console.log("[TTHSPlatformClient] Connecting to:", url);
      var ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        this._emit("error", { source: "connect", message: "Failed to create WebSocket", detail: err });
        this._scheduleReconnect();
        return;
      }
      this._ws = ws;

      ws.onopen = this._onOpen.bind(this);
      ws.onmessage = this._onMessage.bind(this);
      ws.onclose = this._onClose.bind(this);
      ws.onerror = this._onError.bind(this);
    }

    /** Intentionally close; no automatic reconnection is scheduled. */
    disconnect() {
      this._intentionalDisconnect = true;
      this._connectionRejected = false; // A manual disconnect allows a later reconnect
      this._stopPingMonitor();

      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
        this._reconnectTimeout = null;
      }

      if (this._ws) {
        try {
          this._ws.close(1000, "Client disconnect");
        } catch (err) {
          /* already closing */
        }
        this._ws = null;
      }
      this._resetInitState();
      this._setState("disconnected");
    }

    isConnected() {
      return this._state === "connected" && this._ws !== null && this._ws.readyState === WebSocket.OPEN;
    }

    getState() {
      return this._state;
    }

    /** True once the whole 4-step init sequence has been ACKed on the current connection. */
    isInitialized() {
      return this._initComplete;
    }

    /** Platform mode ("kiosk" | "sbd") reported by the master ConnectionStatus message. */
    getPlatformMode() {
      return this._platformMode;
    }

    getConfig() {
      return Object.assign({}, this._config);
    }

    /** Re-run the 4-step init sequence on the open connection (also resets session state). */
    restartInit() {
      this._resetInitState();
      this.startInitSequence();
    }

    /**
     * Send an ApplicationData directive. Non-blocking: returns the correlationId
     * (== meta.requestID) used for ACK matching, or null when the socket is not open.
     */
    sendDirective(directive, payload) {
      payload = payload || {};
      if (!this.isConnected()) {
        this._emit("error", {
          source: "sendDirective",
          message: "Cannot send directive '" + directive + "': WebSocket is not open",
        });
        return null;
      }
      var msg = this._buildDirectiveMessage(directive, payload);
      this._ws.send(JSON.stringify(msg));
      this._emit("message", { direction: "out", data: msg });
      return msg.correlationId;
    }

    /** Send a raw object over the socket. Returns false when not connected. */
    sendRaw(data) {
      if (!this.isConnected()) return false;
      this._ws.send(JSON.stringify(data));
      this._emit("message", { direction: "out", data: data });
      return true;
    }

    // ------------------------------------------------------------------
    // Message building (mirrors buildDirectiveMessage in ws-debug-page/page.tsx)
    // ------------------------------------------------------------------

    _buildDirectiveMessage(directive, payload) {
      var requestID = generateUUID();

      // Full CUSS 2.0 meta format when config is available.
      // IMPORTANT: the top-level "directive" and "correlationId" fields are
      // always included because the platform's ConnectionManager routes
      // directives on the top-level field (data.get("directive")) - it never
      // reads meta.directive. meta is kept for CUSS 2.0 spec compliance only.
      if (this._config.deviceId && this._config.oauthUrl) {
        return {
          messageType: "ApplicationData",
          meta: {
            deviceID: this._config.deviceId,
            requestID: requestID,
            oauthToken: this._config.oauthUrl, // placeholder; a real token comes from the OAuth flow
            directive: directive,
          },
          directive: directive,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
          // correlationId for top-level ACK matching (requestID || correlationId)
          correlationId: requestID,
        };
      }

      // Simplified/legacy format (dev fallback)
      return {
        messageType: "ApplicationData",
        correlationId: requestID,
        directive: directive,
        payload: Object.keys(payload).length > 0 ? payload : undefined,
        timestamp: new Date().toISOString(),
      };
    }

    // ------------------------------------------------------------------
    // Init sequence (mirrors buildInitSteps/sendInitStep/handleInitAck)
    // ------------------------------------------------------------------

    _buildInitSteps() {
      var appId = this._config.applicationId;
      return [
        {
          key: "subscribe",
          directive: "subscribe",
          payload: {
            applicationId: appId,
            name: this._config.applicationName,
            vendor: this._config.vendor,
          },
        },
        { key: "environment", directive: "platform_environment", payload: {} },
        { key: "components", directive: "platform_components", payload: {} },
        {
          key: "staterequest",
          directive: "platform_applications_staterequest",
          payload: {
            targetApplicationId: appId,
            requestedState: "ACTIVE",
            reason: "USER_SELECTION",
          },
        },
      ];
    }

    /** Start (or restart) the ACK-chained 4-step init sequence on the open connection. */
    startInitSequence() {
      if (this._initRunning) return;
      if (!this.isConnected()) {
        this._emit("error", {
          source: "startInitSequence",
          message: "Cannot start init sequence: WebSocket is not open",
        });
        return;
      }
      this._initRunning = true;
      this._initSteps = this._buildInitSteps();
      this._initStepIndex = 0;
      this._pendingInitCorrelationId = null;
      this._initComplete = false;
      this._sendInitStep(0);
    }

    _sendInitStep(stepIndex) {
      if (!this._initRunning) return;
      if (stepIndex >= this._initSteps.length) {
        // All steps ACKed; the application is ACTIVE and ready for peripheral operations.
        this._initRunning = false;
        this._pendingInitCorrelationId = null;
        this._initComplete = true;
        this._emit("initComplete", {
          steps: this._initSteps,
          applicationId: this._config.applicationId,
        });
        console.log("[TTHSPlatformClient] Init sequence complete");
        return;
      }

      if (!this.isConnected()) {
        // Connection dropped mid-sequence; a reconnect restarts init via "master".
        this._initRunning = false;
        this._pendingInitCorrelationId = null;
        this._emit("error", {
          source: "initSequence",
          message: "Connection lost during init step " + stepIndex,
        });
        return;
      }

      var step = this._initSteps[stepIndex];
      var msg = this._buildDirectiveMessage(step.directive, step.payload);
      this._pendingInitCorrelationId = msg.correlationId;
      this._initStepIndex = stepIndex;

      this._ws.send(JSON.stringify(msg));
      this._emit("message", { direction: "out", data: msg });
      this._emit("initStep", {
        stepIndex: stepIndex,
        key: step.key,
        status: "sent",
        directive: step.directive,
      });
      console.log("[TTHSPlatformClient] Init step " + (stepIndex + 1) + "/4 sent:", step.directive);
    }

    _handleInitAck(ack) {
      if (!this._initRunning) return;
      var ackId = ack ? ack.requestID || ack.correlationId : null;
      if (ackId === null || ackId === undefined) return;
      if (ackId !== this._pendingInitCorrelationId) return;

      // Surface rejected steps (e.g. ACK_ERROR with a description); the chain
      // still advances, matching the sample-app behavior.
      if (ack.ackCode && ack.ackCode !== "ACK_OK") {
        console.warn(
          "[TTHSPlatformClient] Init step ACK error:",
          ack.ackCode,
          ack.description || ""
        );
        this._emit("error", {
          source: "initSequence",
          message:
            "Init step rejected: " +
            ack.ackCode +
            (ack.description ? " - " + ack.description : ""),
        });
      }

      var stepIndex = this._initStepIndex;
      var step = this._initSteps[stepIndex];
      if (step) {
        this._emit("initStep", {
          stepIndex: stepIndex,
          key: step.key,
          status: "done",
          directive: step.directive,
        });
      }
      // Send next step after a short delay (matches sample-app pacing)
      var self = this;
      setTimeout(function () {
        self._sendInitStep(stepIndex + 1);
      }, INIT_STEP_DELAY_MS);
    }

    _resetInitState() {
      this._initRunning = false;
      this._initStepIndex = 0;
      this._pendingInitCorrelationId = null;
      this._initComplete = false;
    }

    // ------------------------------------------------------------------
    // WebSocket event handlers
    // ------------------------------------------------------------------

    _onOpen() {
      this._backoff.reset();
      this._setState("connected");
      // Do not start init yet -- wait for ConnectionStatus "master" from the platform.
      this._waitingForMaster = true;
      this._startPingMonitor();
    }

    _onMessage(event) {
      var parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch (err) {
        return; // Non-JSON message, ignore
      }
      if (!parsed || typeof parsed !== "object") return;

      this._emit("message", { direction: "in", data: parsed });

      // Auto-pong: a PING message has exactly one key (CUSS 2.0 Section 1.3)
      if ("ping" in parsed && Object.keys(parsed).length === 1) {
        this._lastPingReceived = new Date();
        var pong = { pong: new Date().toISOString() };
        if (this.isConnected()) {
          this._ws.send(JSON.stringify(pong));
          this._emit("message", { direction: "out", data: pong });
        }
        return;
      }

      if (parsed.messageType === "ConnectionStatus" && parsed.status) {
        this._emit("connectionStatus", parsed);
        if (parsed.status === "master") {
          this._platformMode = parsed.platformMode || this._platformMode;
          if (this._waitingForMaster) {
            this._waitingForMaster = false;
            this._emit("master", parsed);
            if (this._autoInit) {
              this.startInitSequence();
            }
          }
        } else if (parsed.status === "rejected") {
          // Another master connection is active: close and never auto-reconnect.
          this._connectionRejected = true;
          this._intentionalDisconnect = true;
          this._emit("rejected", parsed);
          var self = this;
          setTimeout(function () {
            if (self._ws) {
              try {
                self._ws.close(1000, "Connection rejected");
              } catch (err) {
                /* already closing */
              }
            }
          }, 100);
        }
        return;
      }

      if (parsed.messageType === "APIAcknowledgement") {
        this._emit("apiAcknowledgement", parsed);
        // The platform echoes requestID (preferred) or correlationId in the ACK.
        this._handleInitAck(parsed);
        return;
      }

      if (parsed.messageType === "PlatformData") {
        var eventType = parsed.eventType;
        if (eventType === "APPLICATION_STATE_CHANGED" && parsed.payload && parsed.payload.currentState) {
          this._emit("applicationStateChanged", parsed);
        }
        if (eventType === "PLATFORM_STATE_CHANGED" && parsed.payload && parsed.payload.currentState) {
          this._emit("platformStateChanged", parsed);
        }
        if (eventType === "DIRECTIVE_RESULT") {
          this._emit("directiveResult", parsed);
        }
        if (eventType === "DEVICE_COMMAND_ERROR") {
          this._emit("deviceCommandError", parsed);
        }
        if (parsed.payload && parsed.payload.componentList) {
          this._emit("componentList", parsed.payload.componentList);
        }
        return;
      }

      if (parsed.messageType === "deviceStatusChanged") {
        this._emit("deviceStatusChanged", parsed);
      }
    }

    _onClose(event) {
      this._stopPingMonitor();
      this._ws = null;
      this._resetInitState();
      this._emit("close", event);

      if (!this._intentionalDisconnect && !this._connectionRejected) {
        this._scheduleReconnect();
      } else if (this._connectionRejected) {
        console.warn("[TTHSPlatformClient] Reconnection disabled - connection was rejected");
        this._setState("disconnected");
      } else {
        this._setState("disconnected");
      }
    }

    _onError(event) {
      // onclose fires after this; only surface the error.
      this._emit("error", { source: "websocket", message: "WebSocket connection error", detail: event });
    }

    // ------------------------------------------------------------------
    // Reconnection + keep-alive monitoring
    // ------------------------------------------------------------------

    _scheduleReconnect() {
      if (this._reconnectTimeout) return;

      var delay = this._backoff.nextDelay();
      console.log(
        "[TTHSPlatformClient] Reconnecting in " + delay + "ms (attempt " + this._backoff.getAttempts() + ")"
      );
      this._setState("reconnecting");

      var self = this;
      this._reconnectTimeout = setTimeout(function () {
        self._reconnectTimeout = null;
        self.connect();
      }, delay);
    }

    _startPingMonitor() {
      this._stopPingMonitor();
      this._lastPingReceived = new Date();

      var self = this;
      this._pingTimer = setInterval(function () {
        if (!self._lastPingReceived) return;
        var elapsed = Date.now() - self._lastPingReceived.getTime();
        if (elapsed > self._pingTimeoutMs) {
          console.error(
            "[TTHSPlatformClient] Platform PING timeout - no PING received in",
            Math.round(elapsed / 1000),
            "seconds"
          );
          self._emit("error", { source: "pingMonitor", message: "Platform unreachable: no PING received" });
          if (self._ws) {
            try {
              self._ws.close(1000, "Platform ping timeout");
            } catch (err) {
              /* already closing */
            }
          }
        }
      }, PING_CHECK_INTERVAL_MS);
    }

    _stopPingMonitor() {
      if (this._pingTimer) {
        clearInterval(this._pingTimer);
        this._pingTimer = null;
      }
      this._lastPingReceived = null;
    }

    _setState(state) {
      if (this._state === state) return;
      this._state = state;
      this._emit("stateChange", state);
    }
  }

  // Expose as classic-script globals
  global.TTHSPlatformClient = TTHSPlatformClient;
  global.TTHSPlatformClient.parseStartupParams = parseStartupParams;
  global.TTHSPlatformClient.DEFAULT_CONFIG = DEFAULT_CONFIG;
})(typeof window !== "undefined" ? window : this);
